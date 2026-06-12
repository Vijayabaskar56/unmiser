import { asc, eq, inArray } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { categories, ruleApplications, subcategories, transactionRules } from "@/db/schema";
import { nowIso } from "@/db/utils";
import {
  parseActions,
  parseConditions,
  serializeActions,
  serializeConditions,
} from "@/lib/rules/dsl";
import type {
  FieldChange,
  RuleDefinition,
  RuleLookupContext,
  RuleAction,
  RuleCondition,
} from "@/lib/rules/types";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

export interface SaveRuleInput {
  id?: string;
  name: string;
  description?: string | null;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isActive?: boolean;
  isSystemTemplate?: boolean;
}

export async function saveRule(db: Db, input: SaveRuleInput): Promise<string> {
  const id = input.id ?? crypto.randomUUID();
  const timestamp = nowIso();
  const values = {
    id,
    name: input.name,
    description: input.description ?? null,
    priority: input.priority,
    conditions: serializeConditions(input.conditions),
    actions: serializeActions(input.actions),
    isActive: input.isActive ?? true,
    isSystemTemplate: input.isSystemTemplate ?? false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db
    .insert(transactionRules)
    .values(values)
    .onConflictDoUpdate({
      target: transactionRules.id,
      set: {
        name: values.name,
        description: values.description,
        priority: values.priority,
        conditions: values.conditions,
        actions: values.actions,
        isActive: values.isActive,
        isSystemTemplate: values.isSystemTemplate,
        updatedAt: timestamp,
      },
    });
  return id;
}

export async function listActiveRules(db: Db): Promise<RuleDefinition[]> {
  const rows = await db
    .select()
    .from(transactionRules)
    .where(eq(transactionRules.isActive, true))
    .orderBy(asc(transactionRules.priority));
  return rows.map(ruleRowToDefinition);
}

export function ruleRowToDefinition(row: typeof transactionRules.$inferSelect): RuleDefinition {
  return {
    id: row.id,
    name: row.name,
    priority: row.priority,
    conditions: parseConditions(row.conditions),
    actions: parseActions(row.actions),
    isActive: row.isActive,
  };
}

export async function buildRuleLookupContext(db: Db): Promise<RuleLookupContext> {
  const [categoryRows, subcategoryRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories),
    db
      .select({
        id: subcategories.id,
        name: subcategories.name,
        categoryId: subcategories.categoryId,
      })
      .from(subcategories),
  ]);

  return {
    categoryById: new Map(categoryRows.map((row) => [row.id, row])),
    categoryByName: new Map(categoryRows.map((row) => [row.name.trim().toLowerCase(), row])),
    subcategoryById: new Map(subcategoryRows.map((row) => [row.id, row])),
    subcategoryByName: new Map(subcategoryRows.map((row) => [row.name.trim().toLowerCase(), row])),
  };
}

export async function insertRuleApplications(
  db: Db,
  transactionId: number,
  applications: Array<{ ruleId: string; ruleName: string; fieldsModified: FieldChange[] }>,
): Promise<void> {
  if (applications.length === 0) return;
  const appliedAt = nowIso();
  await db.insert(ruleApplications).values(
    applications.map((application) => ({
      id: crypto.randomUUID(),
      ruleId: application.ruleId,
      ruleName: application.ruleName,
      transactionId: String(transactionId),
      fieldsModified: JSON.stringify(application.fieldsModified),
      appliedAt,
    })),
  );
}

export async function seedSystemRuleTemplates(db: Db): Promise<void> {
  const existing = await db
    .select({ id: transactionRules.id })
    .from(transactionRules)
    .where(inArray(transactionRules.id, ["system-small-food", "system-subscription"]));
  const existingIds = new Set(existing.map((row) => row.id));

  const templates: SaveRuleInput[] = [
    {
      id: "system-small-food",
      name: "Small payments to Food",
      description: "Template for routing low-value food merchants.",
      priority: 500,
      isActive: false,
      isSystemTemplate: true,
      conditions: [
        { field: "AMOUNT", operator: "LESS_THAN", value: "250" },
        { field: "MERCHANT", operator: "REGEX_MATCHES", value: "(swiggy|zomato|cafe)" },
      ],
      actions: [{ actionType: "SET", field: "CATEGORY", value: "Food & Drinks" }],
    },
    {
      id: "system-subscription",
      name: "Subscription merchants",
      description: "Template for common recurring payment text.",
      priority: 520,
      isActive: false,
      isSystemTemplate: true,
      conditions: [
        { field: "SMS_TEXT", operator: "REGEX_MATCHES", value: "(subscription|mandate|renewal)" },
      ],
      actions: [{ actionType: "SET", field: "CATEGORY", value: "Subscription" }],
    },
  ];

  for (const template of templates) {
    if (!existingIds.has(template.id!)) await saveRule(db, template);
  }
}
