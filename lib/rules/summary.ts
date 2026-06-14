import type {
  ConditionOperator,
  RuleAction,
  RuleCondition,
  TransactionField,
} from "@/lib/rules/types";

/**
 * Human-readable summaries for the rules list/detail rows — turns a stored
 * RuleCondition/RuleAction into a `{ label, value }` pair (the value is shown as
 * a chip in the UI: `IF <label> [value]`, `THEN <label> [value]`). Pure.
 */

const FIELD_WORD: Record<TransactionField, string> = {
  AMOUNT: "amount",
  TYPE: "type",
  CATEGORY: "category",
  MERCHANT: "merchant",
  NARRATION: "note",
  SMS_TEXT: "SMS text",
  SMS_SENDER: "sender",
  BANK_NAME: "bank",
  SUBCATEGORY: "subcategory",
};

const OPERATOR_WORD: Record<ConditionOperator, string> = {
  EQUALS: "is",
  NOT_EQUALS: "is not",
  CONTAINS: "contains",
  NOT_CONTAINS: "doesn't contain",
  STARTS_WITH: "starts with",
  ENDS_WITH: "ends with",
  LESS_THAN: "<",
  GREATER_THAN: ">",
  LESS_THAN_OR_EQUAL: "≤",
  GREATER_THAN_OR_EQUAL: "≥",
  IN: "in",
  NOT_IN: "not in",
  REGEX_MATCHES: "matches",
  IS_EMPTY: "is empty",
  IS_NOT_EMPTY: "is not empty",
};

export function describeCondition(condition: RuleCondition): { label: string; value: string } {
  return {
    label: `${FIELD_WORD[condition.field]} ${OPERATOR_WORD[condition.operator]}`,
    value: condition.value,
  };
}

export function describeAction(action: RuleAction): { label: string; value: string } {
  if (action.actionType === "BLOCK") return { label: "block", value: "" };
  switch (action.field) {
    case "CATEGORY":
      return { label: "category", value: action.value ?? "" };
    case "SUBCATEGORY":
      return { label: "subcategory", value: action.value ?? "" };
    case "ACCOUNT":
      return { label: "account", value: action.value ?? "" };
    case "MERCHANT":
      return { label: "rename", value: action.value ?? "" };
    case "NARRATION":
      return { label: "note", value: action.value ?? "" };
    case "RECURRING":
      return { label: "recurring", value: action.actionType === "CLEAR" ? "off" : "on" };
    case "BILLING_CYCLE":
      return { label: "billing", value: action.value ?? "" };
    case "FLAGGED":
      return { label: "flag", value: action.actionType === "CLEAR" ? "cleared" : "review" };
    default:
      return { label: "set", value: action.value ?? "" };
  }
}
