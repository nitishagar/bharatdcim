import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ─── Tenants ───────────────────────────────────────────────────

export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  gstin: text('gstin'),
  billingAddress: text('billing_address'),
  stateCode: text('state_code').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── Tariff Configs ────────────────────────────────────────────

export const tariffConfigs = sqliteTable('tariff_configs', {
  id: text('id').primaryKey(),
  stateCode: text('state_code').notNull(),
  discom: text('discom').notNull(),
  category: text('category').notNull(),
  effectiveFrom: text('effective_from').notNull(),
  effectiveTo: text('effective_to'),
  billingUnit: text('billing_unit').notNull(), // 'kWh' | 'kVAh'
  baseEnergyRatePaisa: integer('base_energy_rate_paisa').notNull(),
  wheelingChargePaisa: integer('wheeling_charge_paisa').notNull(),
  demandChargePerKvaPaisa: integer('demand_charge_per_kva_paisa').notNull(),
  demandRatchetPercent: integer('demand_ratchet_percent').notNull(),
  minimumDemandKva: integer('minimum_demand_kva').notNull(),
  timeSlotsJson: text('time_slots_json').notNull(), // JSON array of TimeSlotConfig
  fuelAdjustmentPaisa: integer('fuel_adjustment_paisa').notNull(),
  fuelAdjustmentType: text('fuel_adjustment_type').notNull(), // 'absolute' | 'percentage'
  electricityDutyBps: integer('electricity_duty_bps').notNull(),
  pfThresholdBps: integer('pf_threshold_bps').notNull(),
  pfPenaltyRatePaisa: integer('pf_penalty_rate_paisa').notNull(),
  version: integer('version').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── Meters ────────────────────────────────────────────────────

export const meters = sqliteTable('meters', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  siteId: text('site_id'),
  stateCode: text('state_code').notNull(),
  tariffId: text('tariff_id').references(() => tariffConfigs.id),
  meterType: text('meter_type'), // 'grid' | 'dg' | 'solar'
  metadata: text('metadata'), // JSON
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── Power Readings ────────────────────────────────────────────

export const powerReadings = sqliteTable('power_readings', {
  id: text('id').primaryKey(),
  meterId: text('meter_id').notNull().references(() => meters.id),
  timestamp: text('timestamp').notNull(),
  kWh: integer('kwh_paisa'), // stored as integer paisa-equivalent (×1000) for precision
  kW: integer('kw_milliwatts'), // milliwatts for precision
  voltage: integer('voltage_mv'), // millivolts
  current: integer('current_ma'), // milliamps
  powerFactor: integer('power_factor_bps'), // basis points: 9500 = 0.95
  source: text('source'), // 'grid' | 'dg' | 'solar' | 'snmp'
  slotType: text('slot_type'), // 'peak' | 'normal' | 'off-peak'
  slotName: text('slot_name'),
  ratePaisa: integer('rate_paisa'),
  uploadId: text('upload_id'),
  createdAt: text('created_at').notNull(),
});

// ─── Bills ─────────────────────────────────────────────────────

export const bills = sqliteTable('bills', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  meterId: text('meter_id').notNull().references(() => meters.id),
  tariffId: text('tariff_id').notNull().references(() => tariffConfigs.id),
  billingPeriodStart: text('billing_period_start').notNull(),
  billingPeriodEnd: text('billing_period_end').notNull(),
  peakKwh: integer('peak_kwh').notNull(),
  normalKwh: integer('normal_kwh').notNull(),
  offPeakKwh: integer('off_peak_kwh').notNull(),
  totalKwh: integer('total_kwh').notNull(),
  billedKvah: integer('billed_kvah'),
  contractedDemandKva: integer('contracted_demand_kva').notNull(),
  recordedDemandKva: integer('recorded_demand_kva').notNull(),
  billedDemandKva: integer('billed_demand_kva').notNull(),
  powerFactor: integer('power_factor_bps').notNull(), // basis points
  peakChargesPaisa: integer('peak_charges_paisa').notNull(),
  normalChargesPaisa: integer('normal_charges_paisa').notNull(),
  offPeakChargesPaisa: integer('off_peak_charges_paisa').notNull(),
  totalEnergyChargesPaisa: integer('total_energy_charges_paisa').notNull(),
  wheelingChargesPaisa: integer('wheeling_charges_paisa').notNull(),
  demandChargesPaisa: integer('demand_charges_paisa').notNull(),
  fuelAdjustmentPaisa: integer('fuel_adjustment_paisa').notNull(),
  electricityDutyPaisa: integer('electricity_duty_paisa').notNull(),
  pfPenaltyPaisa: integer('pf_penalty_paisa').notNull(),
  dgChargesPaisa: integer('dg_charges_paisa').notNull(),
  subtotalPaisa: integer('subtotal_paisa').notNull(),
  gstPaisa: integer('gst_paisa').notNull(),
  totalBillPaisa: integer('total_bill_paisa').notNull(),
  effectiveRatePaisaPerKwh: integer('effective_rate_paisa_per_kwh').notNull(),
  status: text('status').notNull().default('draft'), // 'draft' | 'finalized' | 'invoiced'
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── Invoices ──────────────────────────────────────────────────

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  billId: text('bill_id').notNull().references(() => bills.id),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  invoiceNumber: text('invoice_number').notNull().unique(),
  financialYear: text('financial_year').notNull(), // e.g. '2526'
  supplierGstin: text('supplier_gstin').notNull(),
  recipientGstin: text('recipient_gstin').notNull(),
  taxType: text('tax_type').notNull(), // 'CGST_SGST' | 'IGST'
  taxableAmountPaisa: integer('taxable_amount_paisa').notNull(),
  cgstPaisa: integer('cgst_paisa'),
  sgstPaisa: integer('sgst_paisa'),
  igstPaisa: integer('igst_paisa'),
  totalTaxPaisa: integer('total_tax_paisa').notNull(),
  totalAmountPaisa: integer('total_amount_paisa').notNull(),
  status: text('status').notNull().default('draft'), // 'draft' | 'finalized' | 'cancelled'
  invoiceDate: text('invoice_date').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── Invoice Sequences ─────────────────────────────────────────

export const invoiceSequences = sqliteTable('invoice_sequences', {
  id: text('id').primaryKey(),
  financialYear: text('financial_year').notNull().unique(),
  lastSequence: integer('last_sequence').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});

// ─── Credit Notes ──────────────────────────────────────────────

export const creditNotes = sqliteTable('credit_notes', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  creditNoteNumber: text('credit_note_number').notNull().unique(),
  financialYear: text('financial_year').notNull(),
  amountPaisa: integer('amount_paisa').notNull(),
  taxType: text('tax_type').notNull(),
  cgstPaisa: integer('cgst_paisa'),
  sgstPaisa: integer('sgst_paisa'),
  igstPaisa: integer('igst_paisa'),
  totalTaxPaisa: integer('total_tax_paisa').notNull(),
  totalAmountPaisa: integer('total_amount_paisa').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('draft'),
  creditNoteDate: text('credit_note_date').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── Invoice Audit Log ─────────────────────────────────────────

export const invoiceAuditLog = sqliteTable('invoice_audit_log', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  action: text('action').notNull(), // 'created' | 'finalized' | 'cancelled' | 'credit_note_issued'
  detailsJson: text('details_json'),
  actor: text('actor'),
  createdAt: text('created_at').notNull(),
});

// ─── Agent Heartbeats ─────────────────────────────────────────

export const agentHeartbeats = sqliteTable('agent_heartbeats', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  agentVersion: text('agent_version'),
  deviceCount: integer('device_count').notNull(),
  unsyncedCount: integer('unsynced_count'),
  status: text('status').notNull().default('online'), // 'online' | 'offline'
  lastHeartbeatAt: text('last_heartbeat_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── Upload Audit ──────────────────────────────────────────────

export const uploadAudit = sqliteTable('upload_audit', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(),
  format: text('format'), // 'bharatdcim' | 'nlyte' | 'sunbird' | 'ecostruxure' | 'unknown'
  totalRows: integer('total_rows').notNull(),
  importedRows: integer('imported_rows').notNull(),
  skippedRows: integer('skipped_rows').notNull(),
  errorsJson: text('errors_json'), // JSON array of {code, row, message}
  metersAffected: text('meters_affected'), // JSON array of meter IDs
  processingTimeMs: integer('processing_time_ms').notNull(),
  createdAt: text('created_at').notNull(),
});
