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
} from './mocks/data';

export const handlers = [
  // Query endpoints
  http.get('*/dashboard/summary', () => HttpResponse.json(mockSummary)),
  http.get('*/meters',            () => HttpResponse.json(mockMeters)),
  http.get('*/meters/:id',        () => HttpResponse.json(mockMeter)),
  http.get('*/readings',          () => HttpResponse.json(mockReadings)),
  http.get('*/tariffs',           () => HttpResponse.json(mockTariffs)),
  http.get('*/bills',             () => HttpResponse.json(mockBills)),
  http.get('*/bills/:id',         () => HttpResponse.json(mockBill)),
  http.get('*/invoices',          () => HttpResponse.json(mockInvoices)),
  http.get('*/invoices/:id',      () => HttpResponse.json(mockInvoice)),
  http.get('*/uploads',           () => HttpResponse.json(mockUploads)),
  http.get('*/uploads/:id',       () => HttpResponse.json(mockUpload)),
  http.get('*/agents',            () => HttpResponse.json(mockAgents)),
  http.get('*/platform/overview', () => HttpResponse.json(mockPlatformOverview)),
  http.get('*/platform/tenants',  () => HttpResponse.json(mockPlatformTenants)),

  // Mutation endpoints
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
