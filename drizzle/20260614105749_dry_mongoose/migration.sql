ALTER TABLE `accounts` ADD `sourceKind` text DEFAULT 'BANK' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `bankSubtype` text;--> statement-breakpoint
-- Backfill the canonical kind from the legacy derived flags (CREDIT/CASH win
-- over the BANK default; everything else stays BANK).
UPDATE `accounts` SET `sourceKind` = 'CREDIT' WHERE `isCreditCard` = 1;--> statement-breakpoint
UPDATE `accounts` SET `sourceKind` = 'CASH' WHERE `isWallet` = 1;