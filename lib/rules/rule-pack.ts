import * as v from "valibot";

import { ruleActionSchema, ruleConditionSchema } from "@/lib/rules/dsl";

export const rulePackRuleSchema = v.object({
  id: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  priority: v.optional(v.number(), 500),
  conditions: v.array(ruleConditionSchema),
  actions: v.array(ruleActionSchema),
});

export const rulePackSchema = v.object({
  schemaVersion: v.literal("1.0"),
  pluginId: v.string(),
  type: v.literal("rule"),
  name: v.string(),
  country: v.string(),
  version: v.string(),
  rules: v.array(rulePackRuleSchema),
});

export type RulePack = v.InferOutput<typeof rulePackSchema>;
