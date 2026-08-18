CREATE TABLE `break_audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceAppointmentId` varchar(64) NOT NULL,
	`technicianCsso` varchar(64) NOT NULL,
	`reason` varchar(255) NOT NULL,
	`evidenceUrl` text NOT NULL,
	`evidenceKey` text,
	`latitude` varchar(64),
	`longitude` varchar(64),
	`capturedAt` varchar(64),
	`status` varchar(32) NOT NULL DEFAULT 'completed',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `break_audits_id` PRIMARY KEY(`id`)
);
