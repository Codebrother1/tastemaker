CREATE TABLE `import_audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`format` enum('csv','readwise','twitter') NOT NULL,
	`filename` varchar(500),
	`inserted` int NOT NULL,
	`skipped` int NOT NULL,
	`truncated` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `import_audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `clip_annotations` ADD `contentHash` varchar(64);--> statement-breakpoint
CREATE INDEX `import_audits_user_idx` ON `import_audits` (`userId`);