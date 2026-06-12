import { BTreeIndex } from "@tanstack/db";

import { createDrizzleCollection } from "@/db/collection-factory";
import { db } from "@/db/index";
import { subscriptions, type Subscription } from "@/db/schema";

export const subscriptionCollection = createDrizzleCollection<Subscription>({
  db,
  table: subscriptions,
  getKey: (subscription) => subscription.id,
});

subscriptionCollection.createIndex((subscription) => subscription.nextPaymentDate ?? "", {
  indexType: BTreeIndex,
});
