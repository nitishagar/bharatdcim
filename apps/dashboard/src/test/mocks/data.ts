import type { Meter } from '../../api/hooks/useMeters';
import type { Bill } from '../../api/hooks/useBills';
import type { Invoice } from '../../api/hooks/useInvoices';
import type { Tariff } from '../../api/hooks/useTariffs';
import type { Upload } from '../../api/hooks/useUploads';
import type { Agent } from '../../api/hooks/useAgents';

export const mockSummary = {
  meters: { total: 3 },
  bills: { total: 5, totalAmountPaisa: 500000, totalKwh: 1250 },
  invoices: { total: 2 },
  agents: { total: 1, online: 1 },
};

export const mockMeter: Meter = {
  id: 'meter-001',
  tenantId: 'tenant-001',
  name: 'Main Grid Meter',
  siteId: null,
  stateCode: 'KA',
  tariffId: 'tariff-001',
  meterType: 'grid',
  metadata: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export const mockMeters: Meter[] = [mockMeter];

export const mockReadings = [
  {
    id: 'reading-001',
    meterId: 'meter-001',
    timestamp: '2026-01-15T10:00:00Z',
    kWh: 100000,
    kW: null,
    voltage: null,
    current: null,
    powerFactor: null,
    source: 'csv',
    slotType: 'normal',
    slotName: 'Normal',
    ratePaisa: 700,
    uploadId: null,
    createdAt: '2026-01-15T10:00:00Z',
  },
];

export const mockTariff: Tariff = {
  id: 'tariff-001',
  stateCode: 'KA',
  discom: 'BESCOM',
  category: 'HT',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  billingUnit: 'kWh',
  baseEnergyRatePaisa: 700,
  wheelingChargePaisa: 50,
  demandChargePerKvaPaisa: 30000,
  demandRatchetPercent: 90,
  minimumDemandKva: 0,
  timeSlotsJson: '[]',
  fuelAdjustmentPaisa: 20,
  fuelAdjustmentType: 'fixed',
  electricityDutyBps: 500,
  pfThresholdBps: 9000,
  pfPenaltyRatePaisa: 50,
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export const mockTariffs: Tariff[] = [mockTariff];

export const mockBill: Bill = {
  id: 'bill-001',
  tenantId: 'tenant-001',
  meterId: 'meter-001',
  tariffId: 'tariff-001',
  billingPeriodStart: '2026-01-01',
  billingPeriodEnd: '2026-01-31',
  peakKwh: 200,
  normalKwh: 600,
  offPeakKwh: 200,
  totalKwh: 1000,
  contractedDemandKva: 100,
  recordedDemandKva: 90,
  billedDemandKva: 100,
  powerFactor: 0.95,
  peakChargesPaisa: 140000,
  normalChargesPaisa: 420000,
  offPeakChargesPaisa: 100000,
  totalEnergyChargesPaisa: 660000,
  wheelingChargesPaisa: 50000,
  demandChargesPaisa: 300000,
  fuelAdjustmentPaisa: 20000,
  electricityDutyPaisa: 51500,
  pfPenaltyPaisa: 0,
  dgChargesPaisa: 0,
  subtotalPaisa: 1081500,
  gstPaisa: 194670,
  totalBillPaisa: 1276170,
  effectiveRatePaisaPerKwh: 1276,
  status: 'draft',
  createdAt: '2026-01-31T12:00:00Z',
  updatedAt: '2026-01-31T12:00:00Z',
};

export const mockBills: Bill[] = [mockBill];

export const mockInvoice: Invoice = {
  id: 'invoice-001',
  billId: 'bill-001',
  tenantId: 'tenant-001',
  invoiceNumber: 'INV-2026-001',
  financialYear: '2025-26',
  supplierGstin: '29ABCDE1234F1Z5',
  recipientGstin: '29XYZPQ9876A1Z3',
  taxType: 'CGST_SGST',
  taxableAmountPaisa: 1081500,
  cgstPaisa: 97335,
  sgstPaisa: 97335,
  igstPaisa: null,
  totalTaxPaisa: 194670,
  totalAmountPaisa: 1276170,
  status: 'active',
  eInvoiceStatus: 'irn_generated',
  irn: 'a'.repeat(64),
  ackNo: '112010000011474',
  ackDt: '2026-03-31 14:30:00',
  signedQrCode: 'eyJhbGciOiJSUzI1NiJ9.mock.signature',
  irnGeneratedAt: '2026-03-31T14:30:00.000Z',
  irnCancelledAt: null,
  invoiceDate: '2026-02-01',
  createdAt: '2026-02-01T09:00:00Z',
  updatedAt: '2026-02-01T09:00:00Z',
};

export const mockInvoicePending: Invoice = {
  ...mockInvoice,
  id: 'invoice-002',
  invoiceNumber: 'INV-2026-002',
  eInvoiceStatus: 'pending_irn',
  irn: null,
  ackNo: null,
  ackDt: null,
  signedQrCode: null,
  irnGeneratedAt: null,
  irnCancelledAt: null,
};

export const mockInvoiceNotApplicable: Invoice = {
  ...mockInvoice,
  id: 'invoice-003',
  invoiceNumber: 'INV-2026-003',
  eInvoiceStatus: 'not_applicable',
  irn: null,
  ackNo: null,
  ackDt: null,
  signedQrCode: null,
  irnGeneratedAt: null,
  irnCancelledAt: null,
};

export const mockInvoices: Invoice[] = [mockInvoice];

export const mockUpload: Upload = {
  id: 'upload-001',
  tenantId: 'tenant-001',
  fileName: 'readings-jan.csv',
  fileSize: 4096,
  format: 'native',
  totalRows: 100,
  importedRows: 98,
  skippedRows: 2,
  errorsJson: null,
  metersAffected: JSON.stringify(['meter-001']),
  processingTimeMs: 350,
  createdAt: '2026-01-31T08:00:00Z',
};

export const mockUploads: Upload[] = [mockUpload];

export const mockAgent: Agent = {
  id: 'agent-001',
  agentId: 'snmp-agent-dc1',
  agentVersion: '1.2.0',
  deviceCount: 12,
  unsyncedCount: 0,
  status: 'online',
  lastHeartbeatAt: '2026-03-13T10:45:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-03-13T10:45:00Z',
};

export const mockAgents: Agent[] = [mockAgent];

export const mockPlatformOverview = {
  tenants: { total: 5 },
  meters: { total: 42 },
  bills: { total: 180, totalAmountPaisa: 9000000 },
  invoices: { total: 75 },
};

export const mockPlatformTenants = [
  {
    id: 'tenant-001',
    name: 'DataCenter Corp',
    stateCode: 'KA',
    gstin: '29ABCDE1234F1Z5',
    billingAddress: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

export const mockCreatedTenant = {
  id: 'tenant-new',
  name: 'New DC',
  stateCode: 'DL',
  gstin: null,
  billingAddress: null,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
};

// Asset mock data
export const mockAsset = {
  id: 'asset-001',
  tenantId: 'tenant-001',
  rackId: 'rack-001',
  name: 'Dell PowerEdge R750',
  assetType: 'server' as const,
  manufacturer: 'Dell',
  model: 'PowerEdge R750',
  serialNumber: 'SN-001',
  rackUnitStart: 10,
  rackUnitSize: 2,
  status: 'active',
  metadata: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export const mockAssets = [mockAsset];

// Rack mock data
export const mockRack = {
  id: 'rack-001',
  tenantId: 'tenant-001',
  siteId: null,
  name: 'Row A Rack 01',
  location: 'Floor 1, Row A',
  capacityU: 42,
  status: 'active',
  metadata: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export const mockRacks = [mockRack];

// Dispute mock data
export const mockDispute = {
  id: 'dispute-001',
  billId: 'bill-001',
  tenantId: 'tenant-001',
  disputedBy: 'user-001',
  reason: 'Incorrect reading',
  status: 'open' as const,
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
};

// Capacity mock data
export const mockCapacityThreshold = {
  id: 'ct-001',
  tenantId: 'tenant-001',
  meterId: 'meter-001',
  metric: 'kwh_daily',
  warningValue: 800,
  criticalValue: 1000,
  windowDays: 30,
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export const mockCapacityThresholds = [mockCapacityThreshold];

export const mockCapacityForecast = {
  dailyAggregates: [
    { date: '2026-01-01', totalKwh: 500 },
    { date: '2026-01-02', totalKwh: 550 },
    { date: '2026-01-03', totalKwh: 600 },
  ],
  trendSlope: 50,
  r2: 0.98,
  projectedBreachAt: '2026-04-15T00:00:00.000Z',
  thresholds: [mockCapacityThreshold],
};

export const mockCapacityAlert = {
  id: 'alert-001',
  tenantId: 'tenant-001',
  meterId: 'meter-001',
  slaConfigId: null,
  type: 'capacity_critical',
  metric: 'kwh_daily',
  thresholdValue: 1000,
  currentValue: 1100,
  predictedBreachAt: null,
  severity: 'critical',
  status: 'active',
  acknowledgedAt: null,
  resolvedAt: null,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
};

export const mockCapacityAlerts = [mockCapacityAlert];

// SLA mock data
export const mockSLAConfig = {
  id: 'sla-001',
  tenantId: 'tenant-001',
  name: 'Uptime SLA',
  type: 'uptime',
  targetBps: 9900,
  measurementWindow: 'daily',
  meterId: 'meter-001',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  currentCompliance: null,
};

export const mockSLAConfigs = [mockSLAConfig];

export const mockSLAViolation = {
  id: 'viol-001',
  slaConfigId: 'sla-001',
  tenantId: 'tenant-001',
  meterId: 'meter-001',
  periodStart: '2026-01-01T00:00:00Z',
  periodEnd: '2026-01-02T00:00:00Z',
  targetBps: 9900,
  actualBps: 9500,
  gapBps: 400,
  severity: 'warning',
  status: 'open',
  acknowledgedAt: null,
  resolvedAt: null,
  createdAt: '2026-01-02T00:00:00Z',
};

export const mockSLAViolations = [mockSLAViolation];

// Notification config mock data
export const mockNotificationConfig = {
  id: 'nc-001',
  tenantId: 'tenant-001',
  name: 'Ops Email',
  type: 'email',
  destination: 'ops@example.com',
  eventsJson: '["capacity_warning","sla_breach"]',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export const mockNotificationConfigs = [mockNotificationConfig];
