ALTER TABLE `appointments` ADD `location_id` text REFERENCES `locations`(`id`);
--> statement-breakpoint
ALTER TABLE `conversations` ADD `location_id` text REFERENCES `locations`(`id`);
--> statement-breakpoint
ALTER TABLE `integration_connections` ADD `location_id` text REFERENCES `locations`(`id`);
--> statement-breakpoint
ALTER TABLE `integration_connections` ADD `label` text;
--> statement-breakpoint
DROP INDEX `idx_integrations_clinic_provider`;
--> statement-breakpoint
CREATE INDEX `idx_integrations_clinic_provider` ON `integration_connections` (`clinic_id`,`provider`);
--> statement-breakpoint
CREATE INDEX `idx_integrations_location_provider` ON `integration_connections` (`location_id`,`provider`);
--> statement-breakpoint
ALTER TABLE `manual_payments` ADD `status` text DEFAULT 'paid' NOT NULL;
--> statement-breakpoint
ALTER TABLE `manual_payments` ADD `receipt_url` text;
--> statement-breakpoint
CREATE TABLE `membership_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`membership_id` text NOT NULL,
	`location_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_membership_locations_unique` ON `membership_locations` (`membership_id`,`location_id`);
--> statement-breakpoint
CREATE INDEX `idx_membership_locations_clinic_location` ON `membership_locations` (`clinic_id`,`location_id`);
--> statement-breakpoint
CREATE TABLE `invitation_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text NOT NULL,
	`location_id` text NOT NULL,
	FOREIGN KEY (`invitation_id`) REFERENCES `invitations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invitation_locations_unique` ON `invitation_locations` (`invitation_id`,`location_id`);
--> statement-breakpoint
CREATE INDEX `idx_appointments_clinic_location_starts` ON `appointments` (`clinic_id`,`location_id`,`starts_at`);
