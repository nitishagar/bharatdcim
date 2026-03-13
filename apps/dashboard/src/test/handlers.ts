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
];
