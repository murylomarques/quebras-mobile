ALTER TABLE `break_audits` MODIFY COLUMN `id` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `break_audits` ADD `imageWidth` int;--> statement-breakpoint
ALTER TABLE `break_audits` ADD `imageHeight` int;--> statement-breakpoint
ALTER TABLE `break_audits` ADD `imageOrientation` varchar(32);--> statement-breakpoint
ALTER TABLE `break_audits` ADD `exifTimestamp` varchar(64);--> statement-breakpoint
ALTER TABLE `break_audits` ADD `exifGpsLat` varchar(64);--> statement-breakpoint
ALTER TABLE `break_audits` ADD `exifGpsLng` varchar(64);