CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`amount` text NOT NULL,
	`merchantName` text NOT NULL,
	`categoryId` integer NOT NULL,
	`subcategoryId` integer,
	`categoryName` text,
	`subcategoryName` text,
	`transactionType` text NOT NULL,
	`dateTime` text NOT NULL,
	`description` text,
	`smsBody` text,
	`bankName` text,
	`smsSender` text,
	`accountNumber` text,
	`balanceAfter` text,
	`transactionHash` text DEFAULT '' NOT NULL,
	`isRecurring` integer DEFAULT false NOT NULL,
	`isDeleted` integer DEFAULT false NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`fromAccount` text,
	`toAccount` text,
	`billingCycle` text,
	`attachments` text DEFAULT '' NOT NULL,
	`isSample` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_transactions_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`),
	CONSTRAINT `fk_transactions_subcategoryId_subcategories_id_fk` FOREIGN KEY (`subcategoryId`) REFERENCES `subcategories`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`iconResId` integer DEFAULT 0 NOT NULL,
	`iconName` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`isSystem` integer DEFAULT false NOT NULL,
	`isIncome` integer DEFAULT false NOT NULL,
	`displayOrder` integer DEFAULT 999 NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `merchant_mappings` (
	`merchantName` text PRIMARY KEY,
	`categoryId` integer NOT NULL,
	`categoryName` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	CONSTRAINT `fk_merchant_mappings_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `subcategories` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`categoryId` integer NOT NULL,
	`name` text NOT NULL,
	`iconResId` integer DEFAULT 0 NOT NULL,
	`iconName` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#757575' NOT NULL,
	`isSystem` integer DEFAULT false NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	CONSTRAINT `fk_subcategories_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `account_balances` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`accountId` integer NOT NULL,
	`balance` text NOT NULL,
	`timestamp` text NOT NULL,
	`transactionId` integer,
	`smsSource` text,
	`sourceType` text,
	`createdAt` text NOT NULL,
	CONSTRAINT `fk_account_balances_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`bankName` text NOT NULL,
	`accountLast4` text NOT NULL,
	`iconResId` integer DEFAULT 0 NOT NULL,
	`iconName` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#33B5E5' NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`isWallet` integer DEFAULT false NOT NULL,
	`isCreditCard` integer DEFAULT false NOT NULL,
	`creditLimit` text,
	`isSample` integer DEFAULT false NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`cardLast4` text NOT NULL,
	`cardType` text NOT NULL,
	`bankName` text NOT NULL,
	`accountId` integer,
	`nickname` text,
	`isActive` integer DEFAULT true NOT NULL,
	`lastBalance` text,
	`lastBalanceSource` text,
	`lastBalanceDate` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`isSample` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_cards_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `budget_category_limits` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`budgetId` integer NOT NULL,
	`categoryId` integer NOT NULL,
	`categoryName` text,
	`limitAmount` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	CONSTRAINT `fk_budget_category_limits_budgetId_budgets_id_fk` FOREIGN KEY (`budgetId`) REFERENCES `budgets`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_budget_category_limits_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`amount` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`startDate` text NOT NULL,
	`endDate` text NOT NULL,
	`periodType` text DEFAULT 'MONTHLY' NOT NULL,
	`trackType` text DEFAULT 'ALL_TRANSACTIONS' NOT NULL,
	`budgetType` text DEFAULT 'EXPENSE' NOT NULL,
	`accountIds` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#4CAF50' NOT NULL,
	`isSample` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`merchantName` text NOT NULL,
	`amount` text NOT NULL,
	`nextPaymentDate` text,
	`state` text DEFAULT 'ACTIVE' NOT NULL,
	`bankName` text,
	`umn` text,
	`categoryId` integer,
	`subcategoryId` integer,
	`categoryName` text,
	`subcategoryName` text,
	`smsBody` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`billingCycle` text,
	`lastPaidDate` text,
	`isSample` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_subscriptions_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_subscriptions_subcategoryId_subcategories_id_fk` FOREIGN KEY (`subcategoryId`) REFERENCES `subcategories`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `rule_applications` (
	`id` text PRIMARY KEY,
	`ruleId` text NOT NULL,
	`ruleName` text NOT NULL,
	`transactionId` text NOT NULL,
	`fieldsModified` text NOT NULL,
	`appliedAt` text NOT NULL,
	CONSTRAINT `fk_rule_applications_ruleId_transaction_rules_id_fk` FOREIGN KEY (`ruleId`) REFERENCES `transaction_rules`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_rule_applications_transactionId_transactions_id_fk` FOREIGN KEY (`transactionId`) REFERENCES `transactions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `transaction_rules` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text,
	`priority` integer NOT NULL,
	`conditions` text NOT NULL,
	`actions` text NOT NULL,
	`isActive` integer NOT NULL,
	`isSystemTemplate` integer DEFAULT false NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exchange_rates` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`fromCurrency` text NOT NULL,
	`toCurrency` text NOT NULL,
	`rate` text NOT NULL,
	`provider` text NOT NULL,
	`updatedAt` text NOT NULL,
	`expiresAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `unrecognized_sms` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`sender` text NOT NULL,
	`smsBody` text NOT NULL,
	`receivedAt` text NOT NULL,
	`reported` integer DEFAULT false NOT NULL,
	`isDeleted` integer DEFAULT false NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY,
	`message` text NOT NULL,
	`isUser` integer NOT NULL,
	`timestamp` integer NOT NULL,
	`isSystemPrompt` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `webhook_cursors` (
	`profileId` text NOT NULL,
	`dataType` text NOT NULL,
	`lastSuccessAt` text,
	`lastRangeEnd` text,
	`updatedAt` text NOT NULL,
	CONSTRAINT `webhook_cursors_pk` PRIMARY KEY(`profileId`, `dataType`),
	CONSTRAINT `fk_webhook_cursors_profileId_webhook_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `webhook_profiles`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `webhook_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`profileId` text NOT NULL,
	`profileName` text NOT NULL,
	`syncReason` text NOT NULL,
	`status` text NOT NULL,
	`message` text NOT NULL,
	`httpStatus` integer,
	`batchCount` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL,
	CONSTRAINT `fk_webhook_logs_profileId_webhook_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `webhook_profiles`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `webhook_profiles` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`rangePreset` text DEFAULT 'SINCE_LAST_SUCCESS' NOT NULL,
	`customStart` text,
	`customEnd` text,
	`dataTypes` text DEFAULT '' NOT NULL,
	`headersJson` text DEFAULT '[]' NOT NULL,
	`lastError` text,
	`consecutiveFailures` integer DEFAULT 0 NOT NULL,
	`lastSyncedAt` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `index_transactions_transaction_hash` ON `transactions` (`transactionHash`);--> statement-breakpoint
CREATE INDEX `index_transactions_category_id` ON `transactions` (`categoryId`);--> statement-breakpoint
CREATE UNIQUE INDEX `index_categories_name` ON `categories` (`name`);--> statement-breakpoint
CREATE INDEX `index_merchant_mappings_category_id` ON `merchant_mappings` (`categoryId`);--> statement-breakpoint
CREATE INDEX `index_subcategories_category_id` ON `subcategories` (`categoryId`);--> statement-breakpoint
CREATE UNIQUE INDEX `index_account_balances_account_id_timestamp` ON `account_balances` (`accountId`,`timestamp`);--> statement-breakpoint
CREATE INDEX `index_account_balances_account_id` ON `account_balances` (`accountId`);--> statement-breakpoint
CREATE INDEX `index_account_balances_timestamp` ON `account_balances` (`timestamp`);--> statement-breakpoint
CREATE UNIQUE INDEX `index_accounts_bank_name_account_last4` ON `accounts` (`bankName`,`accountLast4`);--> statement-breakpoint
CREATE UNIQUE INDEX `index_cards_bank_name_card_last4` ON `cards` (`bankName`,`cardLast4`);--> statement-breakpoint
CREATE INDEX `index_cards_card_last4` ON `cards` (`cardLast4`);--> statement-breakpoint
CREATE INDEX `index_cards_account_id` ON `cards` (`accountId`);--> statement-breakpoint
CREATE INDEX `index_budget_category_limits_budget_id` ON `budget_category_limits` (`budgetId`);--> statement-breakpoint
CREATE INDEX `index_budget_category_limits_category_id` ON `budget_category_limits` (`categoryId`);--> statement-breakpoint
CREATE INDEX `index_subscriptions_category_id` ON `subscriptions` (`categoryId`);--> statement-breakpoint
CREATE INDEX `index_rule_applications_rule_id` ON `rule_applications` (`ruleId`);--> statement-breakpoint
CREATE INDEX `index_rule_applications_transaction_id` ON `rule_applications` (`transactionId`);--> statement-breakpoint
CREATE INDEX `index_rule_applications_applied_at` ON `rule_applications` (`appliedAt`);--> statement-breakpoint
CREATE INDEX `index_transaction_rules_priority_is_active` ON `transaction_rules` (`priority`,`isActive`);--> statement-breakpoint
CREATE INDEX `index_transaction_rules_name` ON `transaction_rules` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `index_exchange_rates_from_currency_to_currency` ON `exchange_rates` (`fromCurrency`,`toCurrency`);--> statement-breakpoint
CREATE INDEX `index_exchange_rates_from_currency` ON `exchange_rates` (`fromCurrency`);--> statement-breakpoint
CREATE INDEX `index_exchange_rates_to_currency` ON `exchange_rates` (`toCurrency`);--> statement-breakpoint
CREATE INDEX `index_exchange_rates_updated_at` ON `exchange_rates` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `index_exchange_rates_expires_at` ON `exchange_rates` (`expiresAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `index_unrecognized_sms_sender_sms_body` ON `unrecognized_sms` (`sender`,`smsBody`);--> statement-breakpoint
CREATE INDEX `index_webhook_cursors_profile_id` ON `webhook_cursors` (`profileId`);--> statement-breakpoint
CREATE INDEX `index_webhook_logs_profile_id` ON `webhook_logs` (`profileId`);--> statement-breakpoint
CREATE INDEX `index_webhook_logs_created_at` ON `webhook_logs` (`createdAt`);