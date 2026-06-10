CREATE TABLE `plugin_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`pluginId` text NOT NULL,
	`version` text NOT NULL,
	`manifestJson` text NOT NULL,
	`fixturesJson` text DEFAULT '[]' NOT NULL,
	`checksum` text,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plugins` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`pluginId` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`version` text NOT NULL,
	`trust` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`installedAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `sourceType` text DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `sourcePluginId` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `sourcePluginVersion` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `sourceReceivedAt` text;--> statement-breakpoint
ALTER TABLE `unrecognized_sms` ADD `status` text DEFAULT 'UNRECOGNIZED' NOT NULL;--> statement-breakpoint
ALTER TABLE `unrecognized_sms` ADD `reviewReason` text DEFAULT 'NO_PARSER' NOT NULL;--> statement-breakpoint
ALTER TABLE `unrecognized_sms` ADD `pluginId` text;--> statement-breakpoint
ALTER TABLE `unrecognized_sms` ADD `pluginVersion` text;--> statement-breakpoint
ALTER TABLE `unrecognized_sms` ADD `parserConfidence` text;--> statement-breakpoint
ALTER TABLE `unrecognized_sms` ADD `parsedFieldsJson` text;--> statement-breakpoint
ALTER TABLE `unrecognized_sms` ADD `rawMatchesJson` text;--> statement-breakpoint
ALTER TABLE `unrecognized_sms` ADD `resolvedAt` text;--> statement-breakpoint
CREATE UNIQUE INDEX `index_plugin_assets_plugin_id_version` ON `plugin_assets` (`pluginId`,`version`);--> statement-breakpoint
CREATE INDEX `index_plugin_assets_plugin_id` ON `plugin_assets` (`pluginId`);--> statement-breakpoint
CREATE UNIQUE INDEX `index_plugins_plugin_id` ON `plugins` (`pluginId`);--> statement-breakpoint
CREATE INDEX `index_plugins_country` ON `plugins` (`country`);--> statement-breakpoint
CREATE INDEX `index_plugins_enabled` ON `plugins` (`enabled`);--> statement-breakpoint
CREATE INDEX `index_unrecognized_sms_status` ON `unrecognized_sms` (`status`);--> statement-breakpoint
CREATE INDEX `index_unrecognized_sms_plugin_id` ON `unrecognized_sms` (`pluginId`);