ALTER TABLE `transactions` ADD `subscriptionId` integer REFERENCES subscriptions(id);--> statement-breakpoint
CREATE INDEX `index_transactions_subscription_id` ON `transactions` (`subscriptionId`);