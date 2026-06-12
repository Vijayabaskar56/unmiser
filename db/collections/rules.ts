import { BTreeIndex } from "@tanstack/db";

import { createDrizzleCollection } from "@/db/collection-factory";
import { db } from "@/db/index";
import {
  ruleApplications,
  transactionRules,
  type RuleApplication,
  type TransactionRule,
} from "@/db/schema";

export const transactionRuleCollection = createDrizzleCollection<TransactionRule>({
  db,
  table: transactionRules,
  getKey: (rule) => rule.id,
});

transactionRuleCollection.createIndex((rule) => rule.priority, { indexType: BTreeIndex });

export const ruleApplicationCollection = createDrizzleCollection<RuleApplication>({
  db,
  table: ruleApplications,
  getKey: (application) => application.id,
});

ruleApplicationCollection.createIndex((application) => application.appliedAt, {
  indexType: BTreeIndex,
});
