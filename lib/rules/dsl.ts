import * as v from "valibot";

import {
  ACTION_FIELD_ALLOWLIST,
  ACTION_TYPES,
  CONDITION_OPERATORS,
  LOGICAL_OPERATORS,
  TRANSACTION_FIELDS,
  type RuleAction,
  type RuleCondition,
} from "@/lib/rules/types";

export const ruleConditionSchema = v.object({
  field: v.picklist(TRANSACTION_FIELDS),
  operator: v.picklist(CONDITION_OPERATORS),
  value: v.string(),
  logicalOperator: v.optional(v.picklist(LOGICAL_OPERATORS), "AND"),
});

export const ruleActionSchema = v.pipe(
  v.object({
    field: v.optional(v.picklist(ACTION_FIELD_ALLOWLIST)),
    actionType: v.picklist(ACTION_TYPES),
    value: v.optional(v.string()),
  }),
  v.check((action) => {
    if (action.actionType === "BLOCK") return true;
    return action.field !== undefined;
  }, "Non-block actions require an allowed field"),
  v.check((action) => {
    if (action.actionType === "CLEAR" || action.actionType === "BLOCK") return true;
    return action.value !== undefined && action.value.trim().length > 0;
  }, "Action requires a value"),
);

export function parseConditions(json: string): RuleCondition[] {
  return v.parse(v.array(ruleConditionSchema), JSON.parse(json));
}

export function parseActions(json: string): RuleAction[] {
  return v.parse(v.array(ruleActionSchema), JSON.parse(json));
}

export function serializeConditions(conditions: RuleCondition[]): string {
  return JSON.stringify(v.parse(v.array(ruleConditionSchema), conditions));
}

export function serializeActions(actions: RuleAction[]): string {
  return JSON.stringify(v.parse(v.array(ruleActionSchema), actions));
}
