CREATE TABLE IF NOT EXISTS `automation_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`kind` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`offset_minutes` integer DEFAULT 0 NOT NULL,
	`template` text NOT NULL,
	`template_name` text,
	`template_language` text DEFAULT 'es_MX' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_automation_rules_clinic_kind` ON `automation_rules` (`clinic_id`,`kind`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `business_hours` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`location_id` text,
	`day_of_week` integer NOT NULL,
	`opens_at` text NOT NULL,
	`closes_at` text NOT NULL,
	`break_start` text,
	`break_end` text,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_business_hours_clinic_location_day` ON `business_hours` (`clinic_id`,`location_id`,`day_of_week`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_business_hours_clinic_day` ON `business_hours` (`clinic_id`,`day_of_week`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `campaign_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`sent_at` text,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_campaign_recipients_unique` ON `campaign_recipients` (`campaign_id`,`patient_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`name` text NOT NULL,
	`audience` text DEFAULT 'inactive_patients' NOT NULL,
	`template` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_for` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_campaigns_clinic_created` ON `campaigns` (`clinic_id`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `deposit_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`appointment_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'MXN' NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`reference` text,
	`requested_at` text NOT NULL,
	`paid_at` text,
	`verified_by` text,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_deposit_requests_appointment` ON `deposit_requests` (`appointment_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `doctor_hours` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`location_id` text,
	`day_of_week` integer NOT NULL,
	`opens_at` text NOT NULL,
	`closes_at` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_doctor_hours_doctor_location_day` ON `doctor_hours` (`doctor_id`,`location_id`,`day_of_week`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_doctor_hours_clinic_day` ON `doctor_hours` (`clinic_id`,`day_of_week`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `doctor_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`location_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_doctor_locations_unique` ON `doctor_locations` (`doctor_id`,`location_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `integration_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`external_account_id` text,
	`phone_number_id` text,
	`secret_reference` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_integrations_clinic_provider` ON `integration_connections` (`clinic_id`,`provider`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_integrations_phone_number_id` ON `integration_connections` (`phone_number_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'staff' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`token_hash` text,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_invitations_clinic_status` ON `invitations` (`clinic_id`,`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`timezone` text DEFAULT 'America/Mexico_City' NOT NULL,
	`phone` text,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_locations_clinic_active` ON `locations` (`clinic_id`,`active`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `manual_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'MXN' NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`received_at` text NOT NULL,
	`method` text DEFAULT 'bank_transfer' NOT NULL,
	`reference` text,
	`invoice_folio` text,
	`invoice_url` text,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_manual_payments_clinic_received` ON `manual_payments` (`clinic_id`,`received_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'staff' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `saas_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_memberships_clinic_user` ON `memberships` (`clinic_id`,`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_memberships_user_status` ON `memberships` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `organization_profiles` (
	`clinic_id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`business_type` text DEFAULT 'dental' NOT NULL,
	`vertical_template` text DEFAULT 'dental' NOT NULL,
	`brand_color` text DEFAULT '#2e9b7f' NOT NULL,
	`onboarding_status` text DEFAULT 'complete' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_organization_profiles_slug` ON `organization_profiles` (`slug`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `organization_states` (
	`clinic_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`suspended_at` text,
	`suspension_reason` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `patient_events` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`details` text,
	`entity_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_patient_events_patient_created` ON `patient_events` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `platform_admins` (
	`user_id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `saas_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `saas_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`full_name` text,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_saas_users_email` ON `saas_users` (`email`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `scheduled_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`patient_id` text,
	`appointment_id` text,
	`campaign_id` text,
	`kind` text NOT NULL,
	`channel` text DEFAULT 'whatsapp' NOT NULL,
	`recipient` text NOT NULL,
	`body` text NOT NULL,
	`template_name` text,
	`template_language` text DEFAULT 'es_MX' NOT NULL,
	`scheduled_for` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`sent_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_scheduled_messages_status_time` ON `scheduled_messages` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staff_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`user_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `saas_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_staff_notifications_clinic_created` ON `staff_notifications` (`clinic_id`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `subscription_events` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`action` text NOT NULL,
	`previous_value` text,
	`next_value` text,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_subscription_events_clinic_created` ON `subscription_events` (`clinic_id`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `subscription_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price_cents` integer,
	`max_users` integer NOT NULL,
	`max_locations` integer NOT NULL,
	`max_conversations` integer NOT NULL,
	`max_ai_requests` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_subscription_plans_slug` ON `subscription_plans` (`slug`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`status` text DEFAULT 'trialing' NOT NULL,
	`current_period_start` text NOT NULL,
	`current_period_end` text NOT NULL,
	`trial_ends_at` text,
	`billing_provider` text,
	`customer_reference` text,
	`subscription_reference` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_subscriptions_clinic` ON `subscriptions` (`clinic_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `support_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`platform_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`started_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`platform_user_id`) REFERENCES `saas_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_support_sessions_clinic_active` ON `support_sessions` (`clinic_id`,`ended_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `surveys` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`appointment_id` text,
	`score` integer,
	`comment` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`sent_at` text,
	`responded_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_surveys_clinic_status` ON `surveys` (`clinic_id`,`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`metric` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`source_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_usage_clinic_metric_created` ON `usage_events` (`clinic_id`,`metric`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_usage_source` ON `usage_events` (`source_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `waitlist_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`service_id` text,
	`doctor_id` text,
	`preferred_date_from` text,
	`preferred_date_to` text,
	`preferred_time` text,
	`status` text DEFAULT 'waiting' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_waitlist_clinic_status_created` ON `waitlist_entries` (`clinic_id`,`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `conversations` ADD `pending_action` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `pending_payload` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `delivery_status` text DEFAULT 'stored' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `last_error` text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_messages_external_id` ON `messages` (`external_id`);--> statement-breakpoint
ALTER TABLE `patients` ADD `marketing_opt_in` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `patients` ADD `consent_at` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `consent_source` text;