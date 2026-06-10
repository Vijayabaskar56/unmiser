ALTER TABLE `transactions` ADD `accountId` integer REFERENCES accounts(id);--> statement-breakpoint
CREATE INDEX `index_transactions_account_id` ON `transactions` (`accountId`);