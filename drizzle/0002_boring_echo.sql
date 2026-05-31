ALTER TABLE `clip_annotations` ADD `styleGuideVersionId` int;--> statement-breakpoint
ALTER TABLE `clip_annotations` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;