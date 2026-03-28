import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../src/db/schema.js';
import type { Database } from '../src/db/client.js';
import type { AppEnv } from '../src/types.js';

/**
 * Create an in-memory SQLite database with all tables for testing.
 * Uses @libsql/client with file::memory: for isolated test instances.
 */
export async function createTestDb() {
  const client = createClient({ url: 'file::memory:' });
  const db = drizzle(client, { schema });

  // Create all tables
  await client.executeMultiple(`
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

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS racks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      site_id TEXT REFERENCES sites(id),
      name TEXT NOT NULL,
      location TEXT,
      capacity_u INTEGER NOT NULL DEFAULT 42,
      status TEXT NOT NULL DEFAULT 'active',
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      rack_id TEXT REFERENCES racks(id),
      name TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      manufacturer TEXT,
      model TEXT,
      serial_number TEXT,
      rack_unit_start INTEGER,
      rack_unit_size INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meters (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      site_id TEXT,
      rack_id TEXT REFERENCES racks(id),
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

    CREATE TABLE IF NOT EXISTS bill_disputes (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL REFERENCES bills(id),
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      disputed_by TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
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
  `);

  return { db, client };
}

/**
 * Create a Hono app with tenant context for testing.
 * Sets db, tenantId, authType, orgRole, and platformAdmin in context.
 */
export function createAppWithTenant(
  db: Database,
  tenantId: string | null = null,
  options: {
    authType?: 'clerk' | 'api_token';
    orgRole?: string | null;
    platformAdmin?: boolean;
  } = {},
) {
  const {
    authType = 'clerk',
    orgRole = 'admin',
    platformAdmin = false,
  } = options;

  const app = new Hono<AppEnv>();
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json(
        { error: { code: 'FORBIDDEN', message: err.message } },
        err.status,
      );
    }
    throw err;
  });
  app.use('*', async (c, next) => {
    c.set('db', db);
    c.set('tenantId', tenantId);
    c.set('authType', authType);
    c.set('orgRole', orgRole);
    c.set('platformAdmin', platformAdmin);
    await next();
  });
  return app;
}
