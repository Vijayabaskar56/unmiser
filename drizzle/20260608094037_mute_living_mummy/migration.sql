CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY,
	`value` text
);
--> statement-breakpoint
ALTER TABLE `categories` ADD `seedKey` text;--> statement-breakpoint
ALTER TABLE `subcategories` ADD `seedKey` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `canonicalBank` text;--> statement-breakpoint
CREATE INDEX `index_categories_seed_key` ON `categories` (`seedKey`);--> statement-breakpoint
CREATE INDEX `index_subcategories_seed_key` ON `subcategories` (`seedKey`);