# CashQuote

CashQuote is a Production MVP for AI-assisted quote and invoice workflows. It includes an Express API, Prisma/PostgreSQL data layer, shared Zod contracts, and a minimal React/Vite client for the demo workflow.

## MVP Surface

- Demo login with HTTP-only JWT cookie.
- Private-pilot login with email plus access code.
- Business membership-based tenant isolation through `x-business-id`.
- Client, quote, invoice, payment, reminder, AI generation, and Lost Cash Radar APIs.
- Quote-to-invoice conversion with database idempotency through `Invoice.sourceQuoteId`.
- Mock AI fallback when OpenAI is unavailable or fails.
- SMTP reminder email sending with non-production mock fallback.
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

CI runs install, Prisma generate, migrations, lint, typecheck, build, unit/integration/security tests, the PostgreSQL concurrency smoke, high-severity npm audit, production smoke, and Playwright e2e against PostgreSQL.

Private-pilot launch validation:

```bash
npm run validate:prod
```

## Production Start

```bash
npm run build
npm run start:prod
```

`NODE_ENV=production` requires `JWT_SECRET`; startup-auth paths fail closed without it.

Production also requires `DATABASE_URL`, `APP_ORIGIN`, SMTP configuration, and a private, non-default `PILOT_ACCESS_CODE` of at least 16 characters. `ALLOW_MOCK_EMAIL` is not accepted in production; set `TRUST_PROXY=true` only when the deployment has exactly one trusted proxy hop. See `PRODUCTION_READINESS.md` for the full launch gate, Docker path, rollback notes, and smoke flow.

## Boundaries

Payment processing is internal record keeping only; no real processor is integrated. Email uses SMTP in production and mock email only where explicitly allowed. The frontend is intentionally workflow-complete but visually minimal.
