/**
 * TanStack DB collection instances for the core tables, wired to the global
 * @/db/index db via @/db/collection-factory (ADR-0011).
 *
 * The transactions collection cascades account balances on write through its
 * `afterWrite` hook (ADR-0002); the rest are plain optimistic-CRUD entities.
 * Derived state (account balances) is never a collection — only a service +
 * live-query read-projection.
 */
export { transactionCollection } from "./transactions";
export { categoryCollection, merchantMappingCollection, subcategoryCollection } from "./categories";
export { accountCollection, cardCollection } from "./accounts";
export { appSettingsCollection } from "./app-settings";
export { enabledPluginAssetCollection, pluginCollection } from "./extensions";
export { smsReviewCollection } from "./sms";
