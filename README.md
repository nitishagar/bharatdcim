# BharatDCIM

Enterprise power billing platform for Indian data centers. Handles Time-of-Day tariff classification, GST-compliant invoicing, multi-vendor CSV import, and SNMP-based real-time metering across 4 state regulatory frameworks (MH, TN, KA, TS).

## Architecture

```
bharatdcim/
├── apps/
│   ├── web/              # Marketing site (Astro 5 + React 19, Cloudflare Pages)
│   └── api/              # Billing API (Hono.js, Cloudflare Workers + Turso)
├── packages/
│   └── billing-engine/   # Core billing library (pure TypeScript, zero IO)
└── agents/
    └── snmp/             # On-premises SNMP polling agent (Go 1.23)
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Build everything
pnpm turbo run build

# Run all tests (158 TypeScript + 17 Go = 175 total)
pnpm turbo run test
cd agents/snmp && make test

# Lint
pnpm turbo run lint
cd agents/snmp && make lint
```

## Packages

### `@bharatdcim/billing-engine`

Pure computation library with no IO dependencies. All monetary values use integer paisa arithmetic (1 rupee = 100 paisa) with Decimal.js for intermediates.

- **ToD Classification**: Per-reading time-of-day slot assignment with overnight wrap-around and pro-rating at boundaries
- **Bill Calculation**: Energy charges, demand charges (with state-specific ratchet), wheeling, fuel adjustment, electricity duty, PF penalty, DG charges, GST
- **Invoice Engine**: GSTIN validation (Luhn mod 36), CGST+SGST vs IGST determination, financial year numbering, credit note validation (GST Section 34)
- **CSV Import**: RFC 4180 parser with auto-detection for Nlyte, Sunbird, EcoStruxure, and native formats

### `@bharatdcim/api`

Hono.js API deployed to Cloudflare Workers with Turso (libSQL) database.

**Endpoints:**
| Route | Description |
|-------|-------------|
| `GET /health` | Health check (no DB) |
| `POST /bills/calculate` | Stateless bill calculation |
| `POST /bills` | Store calculated bill |
| `POST /invoices` | Generate GST invoice from bill |
| `POST /uploads/csv` | Import CSV meter readings |
| `POST /readings/batch` | SNMP agent batch upload |
| `POST /agents/heartbeat` | Agent health reporting |

### `@bharatdcim/web`

Static marketing site built with Astro 5, deployed to Cloudflare Pages. Includes interactive ToD calculator and integration flow widgets.

### `agents/snmp`

Go binary for on-premises deployment. Polls PDU power meters via SNMP, normalizes vendor-specific data (APC, Raritan, ServerTech), buffers in local SQLite, and syncs to the cloud API.

```bash
cd agents/snmp
make build
./bin/snmp-agent --config configs/example.yaml --once
```

## Tariff Coverage

| State | Discom | Category | Billing Unit | Base Rate |
|-------|--------|----------|-------------|-----------|
| Maharashtra | MSEDCL/MERC | HT I(A) Industry | kVAh | ₹8.68 |
| Tamil Nadu | TANGEDCO/TNERC | HT Tariff I | kWh | ₹7.50 |
| Karnataka | BESCOM/KERC | HT-2(a) Industries | kWh | ₹6.60 |
| Telangana | TGSPDCL/TSERC | HT-I(A) General | kVAh | ₹7.65 |

## Test Suite

175 tests across TypeScript and Go:

| Area | Tests | Coverage |
|------|-------|----------|
| Billing calculations | 49 | ToD, demand, energy, property-based |
| Invoice engine | 33 | GST, numbering, credit notes |
| CSV pipeline | 31 | Parsing, format detection, validation |
| API routes & services | 45 | CRUD, import, invoicing, E2E |
| SNMP agent (Go) | 17 | Counter wrap, vendor normalization, sync |

## License

Proprietary. All rights reserved.
