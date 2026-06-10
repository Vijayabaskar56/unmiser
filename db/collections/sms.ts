import { BTreeIndex, createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { type UnrecognizedSms, unrecognizedSms } from "@/db/schema";
import { queryClient } from "@/lib/query-client";

export const smsReviewCollection = createCollection(
  queryCollectionOptions<UnrecognizedSms>({
    queryKey: ["sms_review"],
    queryClient,
    getKey: (row) => row.id,
    // Resolved rows (their SMS later saved as a transaction) stay in the table
    // for provenance but are no longer review work.
    queryFn: async () =>
      db
        .select()
        .from(unrecognizedSms)
        .where(and(eq(unrecognizedSms.isDeleted, false), isNull(unrecognizedSms.resolvedAt))),
  }),
);

// The review screen's live query is orderBy(createdAt desc).limit(25); without
// this index TanStack DB falls back to loading/sorting all rows per update.
smsReviewCollection.createIndex((row) => row.createdAt, { indexType: BTreeIndex });
