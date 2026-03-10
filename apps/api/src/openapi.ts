/**
 * OpenAPI 3.0 specification for BharatDCIM Billing API.
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'BharatDCIM Billing API',
    version: '0.1.0',
    description:
      'Enterprise power billing API for Indian data centers. Handles ToD tariff classification, GST-compliant invoicing, multi-vendor CSV import, and SNMP-based metering.',
  },
  servers: [
    { url: 'https://bharatdcim-api.nitishagar.workers.dev', description: 'Production' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        security: [],
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } } } },
      },
    },
    '/tariffs': {
      get: {
        tags: ['Tariffs'],
        summary: 'List all tariff configs',
        responses: { '200': { description: 'Array of tariff configs' } },
      },
      post: {
        tags: ['Tariffs'],
        summary: 'Create tariff config',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/tariffs/{id}': {
      get: {
        tags: ['Tariffs'],
        summary: 'Get tariff by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Tariff config' }, '404': { description: 'Not found' } },
      },
    },
    '/meters': {
      get: {
        tags: ['Meters'],
        summary: 'List all meters',
        responses: { '200': { description: 'Array of meters' } },
      },
      post: {
        tags: ['Meters'],
        summary: 'Create meter',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/meters/{id}': {
      get: {
        tags: ['Meters'],
        summary: 'Get meter by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Meter' }, '404': { description: 'Not found' } },
      },
    },
    '/bills': {
      get: {
        tags: ['Bills'],
        summary: 'List all bills',
        responses: { '200': { description: 'Array of bills' } },
      },
      post: {
        tags: ['Bills'],
        summary: 'Store a calculated bill',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/bills/calculate': {
      post: {
        tags: ['Bills'],
        summary: 'Calculate bill from readings + tariff (stateless)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['readings', 'tariff'],
                properties: {
                  readings: { type: 'array', description: 'Array of classified power readings' },
                  tariff: { type: 'object', description: 'Full TariffConfig object' },
                  contractedDemandKVA: { type: 'number' },
                  recordedDemandKVA: { type: 'number' },
                  powerFactor: { type: 'number' },
                  dgKWh: { type: 'number' },
                  dgRatePaisa: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Bill calculation result' } },
      },
    },
    '/readings': {
      get: {
        tags: ['Readings'],
        summary: 'Query readings by meter',
        parameters: [
          { name: 'meter_id', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': { description: 'Array of readings' } },
      },
      post: {
        tags: ['Readings'],
        summary: 'Batch insert readings',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { readings: { type: 'array' } } } } } },
        responses: { '201': { description: 'Inserted count' } },
      },
    },
    '/readings/batch': {
      post: {
        tags: ['Readings'],
        summary: 'SNMP agent batch upload',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { readings: { type: 'array' }, agentId: { type: 'string' } } } } } },
        responses: { '201': { description: 'Accepted count' } },
      },
    },
    '/invoices': {
      get: {
        tags: ['Invoices'],
        summary: 'List all invoices',
        responses: { '200': { description: 'Array of invoices' } },
      },
      post: {
        tags: ['Invoices'],
        summary: 'Generate GST invoice from bill',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Created invoice' } },
      },
    },
    '/invoices/{id}': {
      get: {
        tags: ['Invoices'],
        summary: 'Get invoice by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Invoice' }, '404': { description: 'Not found' } },
      },
    },
    '/invoices/{id}/cancel': {
      post: {
        tags: ['Invoices'],
        summary: 'Cancel invoice',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Cancelled' } },
      },
    },
    '/invoices/credit-notes': {
      post: {
        tags: ['Invoices'],
        summary: 'Create credit note',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Created credit note' } },
      },
    },
    '/uploads/csv': {
      post: {
        tags: ['Uploads'],
        summary: 'Import CSV meter readings',
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, tenantId: { type: 'string' }, meterId: { type: 'string' } } } } } },
        responses: { '201': { description: 'Import result' } },
      },
    },
    '/uploads': {
      get: {
        tags: ['Uploads'],
        summary: 'List upload history',
        responses: { '200': { description: 'Array of upload audits' } },
      },
    },
    '/uploads/{id}': {
      get: {
        tags: ['Uploads'],
        summary: 'Get upload audit by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Upload audit' }, '404': { description: 'Not found' } },
      },
    },
    '/agents/heartbeat': {
      post: {
        tags: ['Agents'],
        summary: 'Record agent heartbeat',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { agentId: { type: 'string' }, agentVersion: { type: 'string' }, deviceCount: { type: 'integer' }, unsyncedCount: { type: 'integer' } } } } } },
        responses: { '201': { description: 'Heartbeat recorded' } },
      },
    },
    '/agents': {
      get: {
        tags: ['Agents'],
        summary: 'List registered agents',
        responses: { '200': { description: 'Array of agent heartbeats' } },
      },
    },
    '/platform/tenants': {
      get: {
        summary: 'List all tenants (platform admin only)',
        tags: ['Platform'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Array of tenant objects' },
          '403': { description: 'Forbidden — not a platform admin' },
        },
      },
    },
    '/platform/overview': {
      get: {
        summary: 'Cross-tenant aggregate KPIs (platform admin only)',
        tags: ['Platform'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Cross-tenant aggregate counts (tenants, meters, bills, invoices)' },
          '403': { description: 'Forbidden — not a platform admin' },
        },
      },
    },
    '/dashboard/summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Aggregated KPI summary',
        description: 'Returns total counts for meters, bills, invoices, and agents with aggregate stats.',
        responses: {
          '200': {
            description: 'KPI summary object',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    meters: { type: 'object', properties: { total: { type: 'integer' } } },
                    bills: { type: 'object', properties: { total: { type: 'integer' }, totalAmountPaisa: { type: 'integer' }, totalKwh: { type: 'integer' } } },
                    invoices: { type: 'object', properties: { total: { type: 'integer' } } },
                    agents: { type: 'object', properties: { total: { type: 'integer' }, online: { type: 'integer' } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
