#!/usr/bin/env node
/**
 * Run database migrations against Turso.
 * Usage: npx tsx src/db/migrate.ts
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.
 */
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
  process.exit(1);
}

const client = createClient({ url, authToken });

const migration = `
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gstin TEXT,
    billing_address TEXT,
    state_code TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tariff_configs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id),
    state_code TEXT NOT NULL,
    discom TEXT NOT NULL,
    category TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    billing_unit TEXT NOT NULL,
    base_energy_rate_paisa INTEGER NOT NULL,
    wheeling_charge_paisa INTEGER NOT NULL,
    demand_charge_per_kva_paisa INTEGER NOT NULL,
    demand_ratchet_percent INTEGER NOT NULL,
    minimum_demand_kva INTEGER NOT NULL,
    time_slots_json TEXT NOT NULL,
    fuel_adjustment_paisa INTEGER NOT NULL,
    fuel_adjustment_type TEXT NOT NULL,
    electricity_duty_bps INTEGER NOT NULL,
    pf_threshold_bps INTEGER NOT NULL,
    pf_penalty_rate_paisa INTEGER NOT NULL,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meters (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    site_id TEXT,
    state_code TEXT NOT NULL,
    tariff_id TEXT REFERENCES tariff_configs(id),
    meter_type TEXT,
    metadata TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS power_readings (
    id TEXT PRIMARY KEY,
    meter_id TEXT NOT NULL REFERENCES meters(id),
    timestamp TEXT NOT NULL,
    kwh_paisa INTEGER,
    kw_milliwatts INTEGER,
    voltage_mv INTEGER,
    current_ma INTEGER,
    power_factor_bps INTEGER,
    source TEXT,
    slot_type TEXT,
    slot_name TEXT,
    rate_paisa INTEGER,
    upload_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    meter_id TEXT NOT NULL REFERENCES meters(id),
    tariff_id TEXT NOT NULL REFERENCES tariff_configs(id),
    billing_period_start TEXT NOT NULL,
    billing_period_end TEXT NOT NULL,
    peak_kwh INTEGER NOT NULL,
    normal_kwh INTEGER NOT NULL,
    off_peak_kwh INTEGER NOT NULL,
    total_kwh INTEGER NOT NULL,
    billed_kvah INTEGER,
    contracted_demand_kva INTEGER NOT NULL,
    recorded_demand_kva INTEGER NOT NULL,
    billed_demand_kva INTEGER NOT NULL,
    power_factor_bps INTEGER NOT NULL,
    peak_charges_paisa INTEGER NOT NULL,
    normal_charges_paisa INTEGER NOT NULL,
    off_peak_charges_paisa INTEGER NOT NULL,
    total_energy_charges_paisa INTEGER NOT NULL,
    wheeling_charges_paisa INTEGER NOT NULL,
    demand_charges_paisa INTEGER NOT NULL,
    fuel_adjustment_paisa INTEGER NOT NULL,
    electricity_duty_paisa INTEGER NOT NULL,
    pf_penalty_paisa INTEGER NOT NULL,
    dg_charges_paisa INTEGER NOT NULL,
    subtotal_paisa INTEGER NOT NULL,
    gst_paisa INTEGER NOT NULL,
    total_bill_paisa INTEGER NOT NULL,
    effective_rate_paisa_per_kwh INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL REFERENCES bills(id),
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    invoice_number TEXT NOT NULL UNIQUE,
    financial_year TEXT NOT NULL,
    supplier_gstin TEXT NOT NULL,
    recipient_gstin TEXT NOT NULL,
    tax_type TEXT NOT NULL,
    taxable_amount_paisa INTEGER NOT NULL,
    cgst_paisa INTEGER,
    sgst_paisa INTEGER,
    igst_paisa INTEGER,
    total_tax_paisa INTEGER NOT NULL,
    total_amount_paisa INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    invoice_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoice_sequences (
    id TEXT PRIMARY KEY,
    financial_year TEXT NOT NULL UNIQUE,
    last_sequence INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS credit_notes (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    credit_note_number TEXT NOT NULL UNIQUE,
    financial_year TEXT NOT NULL,
    amount_paisa INTEGER NOT NULL,
    tax_type TEXT NOT NULL,
    cgst_paisa INTEGER,
    sgst_paisa INTEGER,
    igst_paisa INTEGER,
    total_tax_paisa INTEGER NOT NULL,
    total_amount_paisa INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    credit_note_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoice_audit_log (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    action TEXT NOT NULL,
    details_json TEXT,
    actor TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agent_heartbeats (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    agent_version TEXT,
    device_count INTEGER NOT NULL,
    unsynced_count INTEGER,
    tenant_id TEXT REFERENCES tenants(id),
    status TEXT NOT NULL DEFAULT 'online',
    last_heartbeat_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS env_readings (
    id TEXT PRIMARY KEY,
    meter_id TEXT NOT NULL REFERENCES meters(id),
    timestamp TEXT NOT NULL,
    temp_c_tenths INTEGER,
    humidity_pct_tenths INTEGER,
    source TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_env_readings_meter_time ON env_readings(meter_id, timestamp);

  CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    meter_id TEXT REFERENCES meters(id),
    metric TEXT NOT NULL,
    operator TEXT NOT NULL,
    threshold INTEGER NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alert_events (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    rule_id TEXT NOT NULL REFERENCES alert_rules(id),
    meter_id TEXT NOT NULL REFERENCES meters(id),
    value INTEGER NOT NULL,
    threshold INTEGER NOT NULL,
    severity TEXT NOT NULL,
    triggered_at TEXT NOT NULL,
    resolved_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_alert_events_tenant_active ON alert_events(tenant_id, resolved_at);

  CREATE TABLE IF NOT EXISTS upload_audit (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    format TEXT,
    total_rows INTEGER NOT NULL,
    imported_rows INTEGER NOT NULL,
    skipped_rows INTEGER NOT NULL,
    errors_json TEXT,
    meters_affected TEXT,
    processing_time_ms INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`;

async function main() {
  console.log('Running migration against Turso...');
  console.log(`Database: ${url}`);

  await client.executeMultiple(migration);

  // Verify tables were created
  const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log(`\nCreated ${result.rows.length} tables:`);
  for (const row of result.rows) {
    console.log(`  - ${row.name}`);
  }

  console.log('\nMigration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
