import { http, HttpResponse } from 'msw';
import {
  mockSummary,
  mockMeters,
  mockMeter,
  mockReadings,
  mockBills,
  mockBill,
  mockInvoices,
  mockInvoice,
  mockTariffs,
  mockTariff,
  mockUploads,
  mockUpload,
  mockAgents,
  mockPlatformOverview,
  mockPlatformTenants,
  mockCreatedTenant,
  mockCapacityThreshold,
  mockCapacityThresholds,
  mockCapacityForecast,
  mockCapacityAlert,
  mockCapacityAlerts,
  mockSLAConfig,
  mockSLAConfigs,
  mockSLAViolations,
  mockNotificationConfig,
  mockNotificationConfigs,
} from './mocks/data';

function paginatedResponse<T>(items: T[], request: Request) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '25');
  const offset = parseInt(url.searchParams.get('offset') ?? '0');
  return HttpResponse.json({ data: items, total: items.length, limit, offset });
}

export const handlers = [
  // Query endpoints — paginated list responses
  http.get('*/dashboard/summary', () => HttpResponse.json(mockSummary)),
  http.get('*/meters',            ({ request }) => paginatedResponse(mockMeters, request)),
  http.get('*/meters/:id',        () => HttpResponse.json(mockMeter)),
  http.get('*/readings',          ({ request }) => paginatedResponse(mockReadings, request)),
  http.get('*/tariffs',           ({ request }) => paginatedResponse(mockTariffs, request)),
  http.get('*/bills',             ({ request }) => paginatedResponse(mockBills, request)),
  http.get('*/bills/:id',         () => HttpResponse.json(mockBill)),
  http.get('*/invoices',          ({ request }) => paginatedResponse(mockInvoices, request)),
  http.get('*/invoices/:id',      () => HttpResponse.json(mockInvoice)),
  http.get('*/uploads',           ({ request }) => paginatedResponse(mockUploads, request)),
  http.get('*/uploads/:id',       () => HttpResponse.json(mockUpload)),
  http.get('*/agents',            ({ request }) => paginatedResponse(mockAgents, request)),
  http.get('*/platform/overview', () => HttpResponse.json(mockPlatformOverview)),
  http.get('*/platform/tenants',  () => HttpResponse.json(mockPlatformTenants)),

  // Environmental monitoring endpoints
  http.get('*/env-readings/latest', () => HttpResponse.json([
    { id: 'er1', meterId: 'meter-001', timestamp: '2026-03-01T10:00:00Z', tempCTenths: 235, humidityPctTenths: 450 },
  ])),
  http.get('*/env-readings', ({ request }) => {
    const url = new URL(request.url);
    const meterId = url.searchParams.get('meter_id');
    if (!meterId) return HttpResponse.json({ error: { code: 'VALIDATION_ERROR' } }, { status: 400 });
    return HttpResponse.json([
      { id: 'er1', meterId, timestamp: '2026-03-01T10:00:00Z', tempCTenths: 235, humidityPctTenths: 450 },
    ]);
  }),
  http.get('*/alerts', () => HttpResponse.json([])),
  http.get('*/alerts/rules', () => HttpResponse.json([])),
  http.post('*/alerts/rules', () => HttpResponse.json({ id: 'rule-new' }, { status: 201 })),
  http.patch('*/alerts/rules/:id', () => HttpResponse.json({ id: 'rule-1' })),
  http.delete('*/alerts/rules/:id', () => new HttpResponse(null, { status: 204 })),
  http.post('*/alerts/:id/resolve', () => HttpResponse.json({ id: 'ae1', resolvedAt: new Date().toISOString() })),

  // Delete endpoints
  http.delete('*/meters/:id',          () => new HttpResponse(null, { status: 204 })),
  http.delete('*/tariffs/:id',         () => new HttpResponse(null, { status: 204 })),
  http.delete('*/bills/:id',           () => new HttpResponse(null, { status: 204 })),

  // Mutation endpoints
  http.post('*/platform/tenants',      () => HttpResponse.json(mockCreatedTenant, { status: 201 })),
  http.patch('*/platform/tenants/:id', () => HttpResponse.json(mockPlatformTenants[0])),
  http.post('*/meters',                () => HttpResponse.json(mockMeter, { status: 201 })),
  http.patch('*/meters/:id',           () => HttpResponse.json(mockMeter)),
  http.post('*/tariffs',               () => HttpResponse.json(mockTariff, { status: 201 })),
  http.patch('*/tariffs/:id',          () => HttpResponse.json(mockTariff)),
  http.post('*/bills/calculate',       () => HttpResponse.json(mockBill)),
  http.post('*/bills',                 () => HttpResponse.json(mockBill, { status: 201 })),
  http.post('*/invoices',              () => HttpResponse.json(mockInvoice, { status: 201 })),
  http.post('*/invoices/:id/cancel',   () => HttpResponse.json({ ok: true })),
  http.post('*/invoices/credit-notes', () => HttpResponse.json({ ok: true })),
  http.post('*/uploads/csv',           () => HttpResponse.json(mockUpload, { status: 201 })),

  // Capacity endpoints
  http.get('*/capacity/thresholds',    () => HttpResponse.json(mockCapacityThresholds)),
  http.get('*/capacity/forecast',      () => HttpResponse.json(mockCapacityForecast)),
  http.get('*/capacity/alerts',        () => HttpResponse.json(mockCapacityAlerts)),
  http.post('*/capacity/thresholds',   () => HttpResponse.json(mockCapacityThreshold, { status: 201 })),
  http.patch('*/capacity/thresholds/:id', () => HttpResponse.json(mockCapacityThreshold)),
  http.delete('*/capacity/thresholds/:id', () => new HttpResponse(null, { status: 204 })),
  http.patch('*/capacity/alerts/:id',  () => HttpResponse.json({ ...mockCapacityAlert, status: 'acknowledged', acknowledgedAt: new Date().toISOString() })),

  // SLA endpoints
  http.get('*/sla',                    () => HttpResponse.json(mockSLAConfigs)),
  http.get('*/sla/:id/violations',     () => HttpResponse.json({ data: mockSLAViolations, total: 1, limit: 25, offset: 0 })),
  http.get('*/sla/:id',                () => HttpResponse.json(mockSLAConfig)),
  http.post('*/sla',                   () => HttpResponse.json(mockSLAConfig, { status: 201 })),
  http.patch('*/sla/:id',              () => HttpResponse.json(mockSLAConfig)),
  http.delete('*/sla/:id',             () => new HttpResponse(null, { status: 204 })),
  http.patch('*/sla/violations/:id',   () => HttpResponse.json({ ...mockSLAViolations[0], status: 'acknowledged' })),

  // Notification endpoints
  http.get('*/notifications',          () => HttpResponse.json(mockNotificationConfigs)),
  http.post('*/notifications',         () => HttpResponse.json(mockNotificationConfig, { status: 201 })),
  http.patch('*/notifications/:id',    () => HttpResponse.json(mockNotificationConfig)),
  http.delete('*/notifications/:id',   () => new HttpResponse(null, { status: 204 })),
  http.post('*/notifications/:id/test', () => HttpResponse.json({ sent: true, type: 'email', destination: 'ops@example.com' })),
];
