# CashQuote Repo Brief

## Purpose

CashQuote is a private-pilot Production MVP for AI-assisted quote, invoice, payment-recording, reminder, and Lost Cash Radar workflows for small businesses. It is not full public SaaS v1; payments are internal records only.

## Stack

- npm workspaces monorepo on Node.js 22+.
- Backend: Express, TypeScript, Prisma, PostgreSQL, JWT cookie auth, Helmet/CORS/rate limits, Pino request logging.
- Frontend: React, Vite, Tailwind CSS, print/export via `window.print()`.
- Shared contracts: TypeScript/Zod in `packages/shared`.
- Testing: Jest/ts-jest for unit/integration/security, Playwright for e2e.
- Deployment path: one Node service serves `/api/*` and `client/dist`; Dockerfile and GitHub Actions are present.

## Important Entrypoints

- `server/src/index.ts`: Express app/server startup and production SPA serving.
- `client/src/App.tsx`: MVP workflow UI.
- `packages/db/prisma/schema.prisma`: data model and tenant/index source of truth.
- `packages/db/prisma/migrations/`: committed database migrations.
- `scripts/start-prod.mjs`: production migration/start wrapper.
- `scripts/smoke-prod.mjs`: local production smoke probe.
- `.github/workflows/ci.yml`: CI validation flow.

## Commands

- Install: `npm install`
- Generate Prisma client: `npm run prisma:generate`
- Apply migrations: `npm run prisma:migrate`
- Dev API: `npm run dev --workspace server`
- Dev client: `npm run dev --workspace client`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Build: `npm run build`
- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- Security tests: `npm run test:security`
- E2E tests: `npm run test:e2e`
- Full private-pilot gate: `npm run validate:prod`
- Production start: `npm run start:prod`

## Important Directories

- `client/`: React/Vite frontend and print styling.
- `server/`: Express routes, middleware, controllers, services, auth, AI/email adapters.
- `packages/db/`: Prisma schema, migrations, DB client export.
- `packages/shared/`: shared schemas/types.
- `tests/unit`, `tests/integration`, `tests/security`, `tests/e2e`: validation layers.
- `scripts/`: production start and smoke scripts.

## Data, Auth, And External Services

- Every tenant-owned model/query must be scoped by `businessId`; membership is represented through `BusinessMember`.
- Production auth must fail closed without required secrets. Demo login is local/staging only unless explicitly enabled.
- Private pilot login uses `PILOT_ACCESS_CODE` and optional `PILOT_EMAIL_ALLOWLIST`.
- SMTP reminder email requires `SMTP_URL` and `SMTP_FROM` in production; mock email is for non-production only.
- OpenAI is optional; missing/failing live AI should degrade through the mock adapter with telemetry.
- Payment processing is not integrated with Stripe or any real processor.

## Do Not Touch Lightly

- Do not hand-edit generated `dist`, `coverage`, `node_modules`, Playwright reports, or Serena cache.
- Do not commit real `.env` files or secrets.
- Treat Prisma migrations as production-risk changes; verify against a fresh PostgreSQL database.
- Keep `Invoice.sourceQuoteId` conversion idempotency and tenant isolation tests intact.

## Current Unknowns / TODO

- Actual private deployment platform and secret-management path are not encoded here.
- Real SMTP/OpenAI provider credentials are environment responsibilities, not repo defaults.
- Public SaaS features such as Stripe, client portal, team management UI, and full design polish remain out of MVP scope.
