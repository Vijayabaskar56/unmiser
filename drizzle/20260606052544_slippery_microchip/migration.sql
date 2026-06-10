CREATE TABLE `todos` (
	`id` text PRIMARY KEY,
	`text` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`createdAt` text NOT NULL
);
