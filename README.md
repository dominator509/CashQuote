# CashQuote

CashQuote is a Production MVP for AI-assisted quote and invoice workflows. It includes an Express API, Prisma/PostgreSQL data layer, shared Zod contracts, and a minimal React/Vite client for the demo workflow.

## MVP Surface

- Demo login with HTTP-only JWT cookie.
- Business membership-based tenant isolation through `x-business-id`.
- Client, quote, invoice, payment, reminder, AI generation, and Lost Cash Radar APIs.
- Quote-to-invoice conversion with database idempotency through `Invoice.sourceQuoteId`.
- Mock AI fallback when OpenAI is unavailable or fails.
- Mock reminder email sending.
- Minimal client workflow: login, create client, create accepted quote, convert invoice, record payment, schedule/send/resolve reminders, print invoice.

## Setup

1. Install Node.js 22 or newer.
2. Copy `.env.example` to `.env` and set real values.
3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Apply database migrations:

```bash
npm run prisma:migrate
```

## Development

Run the API:

```bash
npm run dev --workspace server
```

Run the client:

```bash
npm run dev --workspace client
```

The Vite dev server proxies `/api` to `http://localhost:3000`.

## Validation

```bash
npm run typecheck
npm run build
npm test
npm run lint
```

CI runs install, Prisma generate, migrations, typecheck, build, and tests against PostgreSQL.

## Production Start

```bash
npm run build
npm run start:prod
```

`NODE_ENV=production` requires `JWT_SECRET`; startup-auth paths fail closed without it.

## Boundaries

Payment processing is internal record keeping only; no real processor is integrated. Email is a mock service. The frontend is intentionally workflow-complete but visually minimal.
