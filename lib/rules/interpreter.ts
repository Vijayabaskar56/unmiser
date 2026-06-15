import Decimal from "decimal.js";

import type {
  ActionField,
  FieldChange,
  RuleAction,
  RuleApplicationChange,
  RuleCondition,
  RuleDefinition,
  RuleEvaluationResult,
  RuleLookupContext,
  RuleTransactionDraft,
  TransactionField,
} from "@/lib/rules/types";

function key(value: string): string {
  return value.trim().toLowerCase();
}

function fieldValue(transaction: RuleTransactionDraft, field: TransactionField): string {
  switch (field) {
    case "AMOUNT":
      return transaction.amount;
    case "TYPE":
      return transaction.transactionType;
    case "CATEGORY":
      return transaction.categoryName ?? String(transaction.categoryId);
    case "MERCHANT":
      return transaction.merchantName;
    case "NARRATION":
      return transaction.description ?? "";
    case "SMS_TEXT":
      return transaction.smsBody ?? "";
    case "SMS_SENDER":
      return transaction.smsSender ?? "";
    case "BANK_NAME":
      return transaction.bankName ?? "";
    case "SUBCATEGORY":
      return transaction.subcategoryName ?? "";
  }
}

function compareNumeric(left: string, right: string): number {
  try {
    return new Decimal(left).cmp(new Decimal(right));
  } catch {
    return left.localeCompare(right);
  }
}

function conditionMatches(
  transaction: RuleTransactionDraft,
  condition: RuleDefinition["conditions"][number],
): boolean {
  const value = fieldValue(transaction, condition.field);
  const target = condition.value;
  switch (condition.operator) {
    case "EQUALS":
      return value.toLowerCase() === target.toLowerCase();
    case "NOT_EQUALS":
      return value.toLowerCase() !== target.toLowerCase();
    case "CONTAINS":
      return value.toLowerCase().includes(target.toLowerCase());
    case "NOT_CONTAINS":
      return !value.toLowerCase().includes(target.toLowerCase());
    case "STARTS_WITH":
      return value.toLowerCase().startsWith(target.toLowerCase());
    case "ENDS_WITH":
      return value.toLowerCase().endsWith(target.toLowerCase());
    case "LESS_THAN":
      return compareNumeric(value, target) < 0;
    case "GREATER_THAN":
      return compareNumeric(value, target) > 0;
    case "LESS_THAN_OR_EQUAL":
      return compareNumeric(value, target) <= 0;
    case "GREATER_THAN_OR_EQUAL":
      return compareNumeric(value, target) >= 0;
    case "IN":
      return target.split(",").some((item) => value.toLowerCase() === item.trim().toLowerCase());
    case "NOT_IN":
      return !target.split(",").some((item) => value.toLowerCase() === item.trim().toLowerCase());
    case "REGEX_MATCHES":
      try {
        return new RegExp(target).test(value);
      } catch {
        return false;
      }
    case "IS_EMPTY":
      return value.trim().length === 0;
    case "IS_NOT_EMPTY":
      return value.trim().length > 0;
  }
}

function ruleMatches(transaction: RuleTransactionDraft, rule: RuleDefinition): boolean {
  if (rule.conditions.length === 0) return true;
  // Rule-level combinator: if ANY condition is tagged "OR" the rule matches when
  // ANY condition matches; otherwise all must match (AND, the default). This is
  // a uniform mode, not mixed precedence — the builder sets the same operator on
  // every condition. Rules with no logicalOperator keep the historical AND.
  const isOr = rule.conditions.some((condition) => condition.logicalOperator === "OR");
  const predicate = (condition: RuleCondition) => conditionMatches(transaction, condition);
  return isOr ? rule.conditions.some(predicate) : rule.conditions.every(predicate);
}

function readActionField(transaction: RuleTransactionDraft, field: ActionField): string | null {
  switch (field) {
    case "CATEGORY":
      return transaction.categoryName ?? String(transaction.categoryId);
    case "SUBCATEGORY":
      return transaction.subcategoryName ?? null;
    case "MERCHANT":
      return transaction.merchantName;
    case "NARRATION":
      return transaction.description ?? null;
    case "RECURRING":
      return transaction.isRecurring ? "true" : "false";
    case "BILLING_CYCLE":
      return transaction.billingCycle ?? null;
    case "ACCOUNT":
      return (
        transaction.accountName ??
        (transaction.accountId != null ? String(transaction.accountId) : null)
      );
    case "FLAGGED":
      return transaction.flagged ? "true" : "false";
  }
}

function textAction(current: string, action: RuleAction): string | null {
  switch (action.actionType) {
    case "SET":
      return action.value ?? "";
    case "APPEND":
      return `${current}${action.value ?? ""}`;
    case "PREPEND":
      return `${action.value ?? ""}${current}`;
    case "CLEAR":
      return null;
    case "BLOCK":
      return current;
  }
}

function pushChange(
  changes: FieldChange[],
  field: ActionField,
  oldValue: string | null,
  newValue: string | null,
  actionType: RuleAction["actionType"],
) {
  if (oldValue === newValue) return;
  changes.push({ field, oldValue, newValue, actionType });
}

function applyAction(
  transaction: RuleTransactionDraft,
  action: RuleAction,
  lookups: RuleLookupContext,
): { transaction: RuleTransactionDraft; changes: FieldChange[] } {
  if (!action.field || action.actionType === "BLOCK") return { transaction, changes: [] };
  const next = { ...transaction };
  const changes: FieldChange[] = [];
  const oldValue = readActionField(transaction, action.field);

  if (action.field === "MERCHANT") {
    const newValue = textAction(transaction.merchantName, action) ?? "";
    next.merchantName = newValue;
    pushChange(changes, "MERCHANT", oldValue, newValue, action.actionType);
    return { transaction: next, changes };
  }

  if (action.field === "NARRATION") {
    const newValue = textAction(transaction.description ?? "", action);
    next.description = newValue;
    pushChange(changes, "NARRATION", oldValue, newValue, action.actionType);
    return { transaction: next, changes };
  }

  if (action.field === "RECURRING") {
    const raw =
      action.actionType === "CLEAR" ? "false" : String(action.value ?? "true").toLowerCase();
    const resolved = raw === "true" || raw === "1" || raw === "yes";
    // Short-circuit when the value is unchanged, consistent with the CATEGORY
    // branch: no mutation to `next`, no pushChange, no audit application.
    if (resolved === (transaction.isRecurring ?? false)) return { transaction, changes: [] };
    next.isRecurring = resolved;
    pushChange(changes, "RECURRING", oldValue, resolved ? "true" : "false", action.actionType);
    return { transaction: next, changes };
  }

  if (action.field === "BILLING_CYCLE") {
    const newValue = textAction(transaction.billingCycle ?? "", action);
    next.billingCycle = newValue;
    pushChange(changes, "BILLING_CYCLE", oldValue, newValue, action.actionType);
    return { transaction: next, changes };
  }

  if (action.field === "ACCOUNT") {
    // Resolve the target account by name; a CLEAR detaches it. An unknown name
    // is a no-op so a typo never silently moves money to the wrong account.
    if (action.actionType === "CLEAR") {
      next.accountId = null;
      next.accountName = null;
      pushChange(changes, "ACCOUNT", oldValue, null, action.actionType);
      return { transaction: next, changes };
    }
    const account = action.value ? lookups.accountByName?.get(key(action.value)) : undefined;
    // Unknown OR ambiguous name (the lookup stores a sentinel for names shared by
    // more than one account) is a no-op so a typo never moves money to the wrong
    // account. account.id < 0 is the ambiguous sentinel.
    if (!account || account.id < 0) return { transaction, changes: [] };
    // Short-circuit when the transaction already points at this account, mirroring
    // the CATEGORY branch. Compare by id (the draft's accountName may be null, e.g.
    // in apply-to-past), so an identical account never produces a redundant change.
    if (transaction.accountId === account.id) return { transaction, changes: [] };
    next.accountId = account.id;
    next.accountName = account.name;
    pushChange(changes, "ACCOUNT", oldValue, account.name, action.actionType);
    return { transaction: next, changes };
  }

  if (action.field === "FLAGGED") {
    const flagged =
      action.actionType === "CLEAR"
        ? false
        : String(action.value ?? "true").toLowerCase() === "true";
    // Short-circuit when the value is unchanged, consistent with the CATEGORY branch.
    if (flagged === (transaction.flagged ?? false)) return { transaction, changes: [] };
    next.flagged = flagged;
    pushChange(changes, "FLAGGED", oldValue, flagged ? "true" : "false", action.actionType);
    return { transaction: next, changes };
  }

  if (action.field === "CATEGORY") {
    const category = action.value ? lookups.categoryByName?.get(key(action.value)) : undefined;
    if (action.actionType !== "CLEAR" && !category) {
      return { transaction, changes: [] };
    }
    const newName = action.actionType === "CLEAR" ? null : (category?.name ?? null);
    next.categoryId = category?.id ?? next.categoryId;
    next.categoryName = newName;
    pushChange(changes, "CATEGORY", oldValue, newName, action.actionType);

    const currentSub = next.subcategoryId
      ? lookups.subcategoryById?.get(next.subcategoryId)
      : undefined;
    if (category && currentSub && currentSub.categoryId !== category.id) {
      const subOld = readActionField(transaction, "SUBCATEGORY");
      next.subcategoryId = null;
      next.subcategoryName = null;
      pushChange(changes, "SUBCATEGORY", subOld, null, "CLEAR");
    }
    return { transaction: next, changes };
  }

  const subcategory = action.value ? lookups.subcategoryByName?.get(key(action.value)) : undefined;
  const newName =
    action.actionType === "CLEAR" ? null : (subcategory?.name ?? action.value ?? null);
  next.subcategoryId =
    action.actionType === "CLEAR" ? null : (subcategory?.id ?? next.subcategoryId);
  next.subcategoryName = newName;
  pushChange(changes, "SUBCATEGORY", oldValue, newName, action.actionType);

  if (subcategory) {
    const category = lookups.categoryById?.get(subcategory.categoryId);
    const categoryOld = readActionField(transaction, "CATEGORY");
    next.categoryId = subcategory.categoryId;
    next.categoryName = category?.name ?? next.categoryName;
    pushChange(changes, "CATEGORY", categoryOld, next.categoryName ?? null, "SET");
  }
  return { transaction: next, changes };
}

export function evaluateRules(
  rules: RuleDefinition[],
  transaction: RuleTransactionDraft,
  lookups: RuleLookupContext = {},
): RuleEvaluationResult {
  const sortedRules = rules.filter((rule) => rule.isActive).sort((a, b) => a.priority - b.priority);
  let nextTransaction = { ...transaction };
  const mutations: FieldChange[] = [];
  const applications: RuleApplicationChange[] = [];

  for (const rule of sortedRules) {
    if (!ruleMatches(nextTransaction, rule)) continue;
    if (rule.actions.some((action) => action.actionType === "BLOCK")) {
      return {
        blocked: { ruleId: rule.id, ruleName: rule.name },
        transaction: nextTransaction,
        mutations,
        applications,
      };
    }

    const ruleChanges: FieldChange[] = [];
    for (const action of rule.actions) {
      const applied = applyAction(nextTransaction, action, lookups);
      nextTransaction = applied.transaction;
      ruleChanges.push(...applied.changes);
    }

    if (ruleChanges.length > 0) {
      mutations.push(...ruleChanges);
      applications.push({
        ruleId: rule.id,
        ruleName: rule.name,
        fieldsModified: ruleChanges,
      });
    }
  }

  return { transaction: nextTransaction, mutations, applications };
}
