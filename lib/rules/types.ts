import type { TransactionType } from "@/db/schema/enums";

export const TRANSACTION_FIELDS = [
  "AMOUNT",
  "TYPE",
  "CATEGORY",
  "MERCHANT",
  "NARRATION",
  "SMS_TEXT",
  "BANK_NAME",
  "SUBCATEGORY",
] as const;
export type TransactionField = (typeof TRANSACTION_FIELDS)[number];

export const CONDITION_OPERATORS = [
  "EQUALS",
  "NOT_EQUALS",
  "CONTAINS",
  "NOT_CONTAINS",
  "STARTS_WITH",
  "ENDS_WITH",
  "LESS_THAN",
  "GREATER_THAN",
  "LESS_THAN_OR_EQUAL",
  "GREATER_THAN_OR_EQUAL",
  "IN",
  "NOT_IN",
  "REGEX_MATCHES",
  "IS_EMPTY",
  "IS_NOT_EMPTY",
] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const LOGICAL_OPERATORS = ["AND", "OR"] as const;
export type LogicalOperator = (typeof LOGICAL_OPERATORS)[number];

export const ACTION_TYPES = ["SET", "APPEND", "PREPEND", "CLEAR", "BLOCK"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_FIELD_ALLOWLIST = [
  "CATEGORY",
  "SUBCATEGORY",
  "MERCHANT",
  "NARRATION",
  "RECURRING",
  "BILLING_CYCLE",
] as const;
export type ActionField = (typeof ACTION_FIELD_ALLOWLIST)[number];

export interface RuleCondition {
  field: TransactionField;
  operator: ConditionOperator;
  value: string;
  logicalOperator?: LogicalOperator;
}

export interface RuleAction {
  field?: ActionField;
  actionType: ActionType;
  value?: string;
}

export interface RuleDefinition {
  id: string;
  name: string;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isActive: boolean;
}

export interface RuleTransactionDraft {
  amount: string;
  transactionType: TransactionType;
  categoryId: number;
  categoryName?: string | null;
  subcategoryId?: number | null;
  subcategoryName?: string | null;
  merchantName: string;
  description?: string | null;
  smsBody?: string | null;
  bankName?: string | null;
  isRecurring?: boolean;
  billingCycle?: string | null;
}

export interface RuleLookupContext {
  categoryById?: Map<number, { id: number; name: string }>;
  categoryByName?: Map<string, { id: number; name: string }>;
  subcategoryById?: Map<number, { id: number; name: string; categoryId: number }>;
  subcategoryByName?: Map<string, { id: number; name: string; categoryId: number }>;
}

export interface FieldChange {
  field: ActionField;
  oldValue: string | null;
  newValue: string | null;
  actionType: ActionType;
}

export interface RuleApplicationChange {
  ruleId: string;
  ruleName: string;
  fieldsModified: FieldChange[];
}

export interface RuleEvaluationResult {
  blocked?: { ruleId: string; ruleName: string };
  transaction: RuleTransactionDraft;
  mutations: FieldChange[];
  applications: RuleApplicationChange[];
}
