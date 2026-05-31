CREATE TABLE `clip_annotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clipId` int NOT NULL,
	`userId` int NOT NULL,
	`data` json NOT NULL,
	`model` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clip_annotations_id` PRIMARY KEY(`id`),
	CONSTRAINT `annotations_clip_unique` UNIQUE(`clipId`)
);
--> statement-breakpoint
CREATE TABLE `clip_collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clipId` int NOT NULL,
	`collectionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clip_collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `clip_collection_pair` UNIQUE(`clipId`,`collectionId`)
);
--> statement-breakpoint
CREATE TABLE `clip_reflections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clipId` int NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clip_reflections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`sourceType` enum('sentence','tweet','paragraph','book','article','other') NOT NULL DEFAULT 'paragraph',
	`sourceTitle` varchar(500),
	`sourceAuthor` varchar(255),
	`sourceUrl` varchar(1000),
	`sourceLocation` varchar(255),
	`labels` json DEFAULT ('[]'),
	`capturedFrom` enum('manual','ocr','import') NOT NULL DEFAULT 'manual',
	`imageKey` varchar(500),
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`kind` enum('project','author','theme','purpose','other') NOT NULL DEFAULT 'other',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `draft_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`styleGuideVersionId` int,
	`draftText` text NOT NULL,
	`scores` json NOT NULL,
	`suggestions` json NOT NULL,
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `draft_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `style_guide_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`versionNumber` int NOT NULL,
	`ruleCount` int NOT NULL,
	`summary` text,
	`artifacts` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `style_guide_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `style_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`patternId` int,
	`title` varchar(255) NOT NULL,
	`positiveInstruction` text NOT NULL,
	`avoidanceGuidance` text NOT NULL,
	`revisionGuidance` text NOT NULL,
	`citationClipIds` json DEFAULT ('[]'),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `style_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taste_patterns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`evidenceClipIds` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taste_patterns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `reflections_clip_idx` ON `clip_reflections` (`clipId`);--> statement-breakpoint
CREATE INDEX `clips_user_idx` ON `clips` (`userId`);--> statement-breakpoint
CREATE INDEX `clips_deleted_idx` ON `clips` (`deletedAt`);--> statement-breakpoint
CREATE INDEX `collections_user_idx` ON `collections` (`userId`);--> statement-breakpoint
CREATE INDEX `drafts_user_idx` ON `draft_reviews` (`userId`);--> statement-breakpoint
CREATE INDEX `guide_versions_user_idx` ON `style_guide_versions` (`userId`);--> statement-breakpoint
CREATE INDEX `rules_user_idx` ON `style_rules` (`userId`);--> statement-breakpoint
CREATE INDEX `patterns_user_idx` ON `taste_patterns` (`userId`);