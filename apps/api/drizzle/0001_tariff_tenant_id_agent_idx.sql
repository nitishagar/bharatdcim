--> statement-breakpoint
ALTER TABLE `tariff_configs` ADD COLUMN `tenant_id` text REFERENCES `tenants`(`id`);
--> statement-breakpoint
CREATE INDEX `idx_agent_heartbeats_agent_id` ON `agent_heartbeats` (`agent_id`);
