CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`meter_id` text NOT NULL,
	`tariff_id` text NOT NULL,
	`billing_period_start` text NOT NULL,
	`billing_period_end` text NOT NULL,
	`peak_kwh` integer NOT NULL,
	`normal_kwh` integer NOT NULL,
	`off_peak_kwh` integer NOT NULL,
	`total_kwh` integer NOT NULL,
	`billed_kvah` integer,
	`contracted_demand_kva` integer NOT NULL,
	`recorded_demand_kva` integer NOT NULL,
	`billed_demand_kva` integer NOT NULL,
	`power_factor_bps` integer NOT NULL,
	`peak_charges_paisa` integer NOT NULL,
	`normal_charges_paisa` integer NOT NULL,
	`off_peak_charges_paisa` integer NOT NULL,
	`total_energy_charges_paisa` integer NOT NULL,
	`wheeling_charges_paisa` integer NOT NULL,
	`demand_charges_paisa` integer NOT NULL,
	`fuel_adjustment_paisa` integer NOT NULL,
	`electricity_duty_paisa` integer NOT NULL,
	`pf_penalty_paisa` integer NOT NULL,
	`dg_charges_paisa` integer NOT NULL,
	`subtotal_paisa` integer NOT NULL,
	`gst_paisa` integer NOT NULL,
	`total_bill_paisa` integer NOT NULL,
	`effective_rate_paisa_per_kwh` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`meter_id`) REFERENCES `meters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tariff_id`) REFERENCES `tariff_configs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `credit_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`credit_note_number` text NOT NULL,
	`financial_year` text NOT NULL,
	`amount_paisa` integer NOT NULL,
	`tax_type` text NOT NULL,
	`cgst_paisa` integer,
	`sgst_paisa` integer,
	`igst_paisa` integer,
	`total_tax_paisa` integer NOT NULL,
	`total_amount_paisa` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`credit_note_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_notes_credit_note_number_unique` ON `credit_notes` (`credit_note_number`);--> statement-breakpoint
CREATE TABLE `invoice_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`action` text NOT NULL,
	`details_json` text,
	`actor` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoice_sequences` (
	`id` text PRIMARY KEY NOT NULL,
	`financial_year` text NOT NULL,
	`last_sequence` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_sequences_financial_year_unique` ON `invoice_sequences` (`financial_year`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`financial_year` text NOT NULL,
	`supplier_gstin` text NOT NULL,
	`recipient_gstin` text NOT NULL,
	`tax_type` text NOT NULL,
	`taxable_amount_paisa` integer NOT NULL,
	`cgst_paisa` integer,
	`sgst_paisa` integer,
	`igst_paisa` integer,
	`total_tax_paisa` integer NOT NULL,
	`total_amount_paisa` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`invoice_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE TABLE `meters` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`site_id` text,
	`state_code` text NOT NULL,
	`tariff_id` text,
	`meter_type` text,
	`metadata` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tariff_id`) REFERENCES `tariff_configs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `power_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`meter_id` text NOT NULL,
	`timestamp` text NOT NULL,
	`kwh_paisa` integer,
	`kw_milliwatts` integer,
	`voltage_mv` integer,
	`current_ma` integer,
	`power_factor_bps` integer,
	`source` text,
	`slot_type` text,
	`slot_name` text,
	`rate_paisa` integer,
	`upload_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`meter_id`) REFERENCES `meters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tariff_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`state_code` text NOT NULL,
	`discom` text NOT NULL,
	`category` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`billing_unit` text NOT NULL,
	`base_energy_rate_paisa` integer NOT NULL,
	`wheeling_charge_paisa` integer NOT NULL,
	`demand_charge_per_kva_paisa` integer NOT NULL,
	`demand_ratchet_percent` integer NOT NULL,
	`minimum_demand_kva` integer NOT NULL,
	`time_slots_json` text NOT NULL,
	`fuel_adjustment_paisa` integer NOT NULL,
	`fuel_adjustment_type` text NOT NULL,
	`electricity_duty_bps` integer NOT NULL,
	`pf_threshold_bps` integer NOT NULL,
	`pf_penalty_rate_paisa` integer NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`gstin` text,
	`billing_address` text,
	`state_code` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `upload_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`format` text,
	`total_rows` integer NOT NULL,
	`imported_rows` integer NOT NULL,
	`skipped_rows` integer NOT NULL,
	`errors_json` text,
	`meters_affected` text,
	`processing_time_ms` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
