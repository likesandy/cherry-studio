CREATE TABLE `preference` (
	`scope` text NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `scope_name_idx` ON `preference` (`scope`,`key`);