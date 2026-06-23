# CashQuote Production Functionality Audit Briefing

Audit date: 2026-06-23
Scope: local repository functionality, production readiness, and code gaps against the repo's own architecture and roadmap.

## Executive Summary

CashQuote currently looks like a backend-only MVP scaffold, not a production-ready QuoteCash SaaS. The Express API, Prisma schema, shared Zod contracts, and targeted white-box tests establish useful groundwork for clients, quotes, invoices, AI line-item generation, quote conversion, and Lost Cash Radar. However, several product-critical surfaces described in `CQ-ARCHITECTURE.md` are missing or only partially implemented.

The highest-risk gaps are tenant authorization, secret handling, missing frontend/document export, missing payment/reminder operations, absent Prisma migrations and CI/deploy wiring, and a validation toolchain that is not currently runnable from a clean checkout without installing dependencies.

## Current Implemented Surface

- Backend API is mounted under `/api` with protected routes for clients, quotes, invoices, AI, and radar in `server/src/index.ts`.
- Demo login can create or reuse a demo user and demo business in `server/src/controllers/auth.controller.ts`.
- Client CRUD, quote CRUD plus conversion, invoice CRUD, AI line-item generation, and radar insight endpoints exist under `server/src/controllers` and `server/src/routes`.
- Prisma models exist for users, businesses, clients, quotes, quote line items, invoices, invoice line items, payments, reminders, AI requests, and activity logs in `packages/db/prisma/schema.prisma`.
- Shared Zod schemas exist for client, quote, invoice, and line-item inputs in `packages/shared/src/index.ts`.
- Unit tests exist for radar and quote-conversion service paths in `tests/unit`.

## Production And Functionality Gaps

### P0 - Tenant authorization is not production-safe

The architecture promises strict tenant isolation and role-aware access control (`CQ-ARCHITECTURE.md:29`, `CQ-ARCHITECTURE.md:32-36`, `CQ-ARCHITECTURE.md:79`). The middleware currently accepts any existing `x-business-id` and explicitly states it does not verify that `req.user.id` has access to that business (`server/src/middlewares/tenant.ts:21-31`). Because `User` and `Business` have no membership/ownership relation in the Prisma schema (`packages/db/prisma/schema.prisma:10-31`), there is no durable way to enforce workspace access.

Impact: any authenticated user who can discover or guess another business ID can operate against that business. This is the main blocker before real multi-tenant production use.

Recommended closure:
- Add a membership/ownership model linking users to businesses.
- Require tenant middleware to verify `req.user.id` against that relation.
- Add cross-tenant negative tests for every protected route family.

### P0 - JWT secret fallback is hardcoded

Both auth middleware and demo login fall back to `fallback-secret-do-not-use-in-prod` (`server/src/middlewares/auth.ts:5`, `server/src/controllers/auth.controller.ts:5`). The architecture requires secret reliance on environment configuration (`CQ-ARCHITECTURE.md:81`, `CQ-ARCHITECTURE.md:140`), but there is no tracked `.env.example`.

Impact: if production starts without `JWT_SECRET`, tokens are signed with a known static secret.

Recommended closure:
- Fail startup in production when `JWT_SECRET` is missing.
- Add `.env.example` documenting `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, and `PORT`.
- Add a test for production missing-secret behavior.

### P0 - Build and test entrypoints are not production-ready

The root package only defines `"test": "echo Error: no test specified"` (`package.json:6-8`) and has no root build script. `npm test` exits successfully while doing no tests. `npm run build` fails because the script is missing. Workspace build scripts exist, but `npm run build --workspace server`, `packages/db`, and `packages/shared` failed locally because `tsc` is not available in the script path; there is no `node_modules` directory in the checkout.

Impact: CI and deployment cannot rely on a single validated command, and local "green" test status can be falsely reported.

Recommended closure:
- Add root scripts for `build`, `test`, `typecheck`, and possibly `prisma:generate`.
- Ensure dependency installation is part of setup docs/CI.
- Make `npm test` run Jest instead of a placeholder.

### P0 - No frontend client or document export exists

The architecture defines a React/Vite client, dashboard, quote builder, invoice viewer, and print/PDF export (`CQ-ARCHITECTURE.md:58-64`, `CQ-ARCHITECTURE.md:69`, `CQ-ARCHITECTURE.md:100-103`). The root workspace includes `"client"` (`package.json:34-37`), but there is no `client` directory in the checkout.

Impact: the repo cannot currently deliver the user-facing SaaS workflow, quote/invoice viewing, or export-to-PDF behavior described in the product requirements.

Recommended closure:
- Scaffold the `client` workspace or remove the workspace/docs claim until implemented.
- Add authenticated route guards, API service layer, quote/invoice views, and print CSS.
- Add an end-to-end smoke test for demo login -> client -> quote -> invoice/export.

### P1 - Payments are modeled but not exposed as functionality

The schema includes `Payment` and invoices include `payments` (`packages/db/prisma/schema.prisma:124-138`, `server/src/controllers/invoice.controller.ts` includes payments in reads), but there are no payment routes/controllers for recording, listing, or applying payments. Invoice status is manually set by update payload rather than derived from recorded payments.

Impact: invoice lifecycle is incomplete for real billing. Paid/unpaid status can drift from actual payment records.

Recommended closure:
- Add payment create/list/delete or adjustment endpoints scoped by `businessId`.
- Recalculate invoice paid state from payment totals.
- Add tests for partial payment, full payment, overpayment rejection, and tenant isolation.

### P1 - Reminder/email workflow is missing

The architecture calls for reminders and an email adapter (`CQ-ARCHITECTURE.md:52-56`, `CQ-ARCHITECTURE.md:74-76`), and the schema has a `Reminder` model (`packages/db/prisma/schema.prisma:140-153`). The code has radar read heuristics but no reminder creation, scheduling, email service, send action, or status transition.

Impact: Lost Cash Radar can identify some risk but cannot perform the follow-up workflow the product promises.

Recommended closure:
- Add reminder service and routes with scheduled/send/resolved transitions.
- Add email adapter interface with a mock implementation.
- Connect radar insights to reminder creation or recommended actions.

### P1 - Quote conversion idempotency is not concurrency-safe

`convertQuoteToInvoice` checks `activityLog` before starting the transaction (`server/src/services/billing/conversion.service.ts:18-31`), then creates invoice and log inside the transaction (`server/src/services/billing/conversion.service.ts:31-67`). There is no unique database constraint on conversion logs and no source quote reference on `Invoice`, so two concurrent requests can both pass the pre-transaction check and create duplicate invoices.

Impact: duplicate invoices can be created for one accepted quote under concurrent traffic.

Recommended closure:
- Add `sourceQuoteId` on `Invoice` or a dedicated unique conversion table/constraint.
- Move idempotency enforcement inside the transaction using a unique constraint.
- Add a concurrency/idempotency integration test.

### P1 - AI fallback only handles missing key, not provider failure

The architecture requires reliable mock fallback if the provider fails (`CQ-ARCHITECTURE.md:45-50`, `CQ-ARCHITECTURE.md:105-108`, `CQ-ARCHITECTURE.md:136`). The controller chooses `OpenAiAdapter` whenever `OPENAI_API_KEY` is present (`server/src/controllers/ai.controller.ts:15-19`). If OpenAI fails, the adapter throws a 500 (`server/src/services/ai/openai.adapter.ts:42-45`) and the controller records failure (`server/src/controllers/ai.controller.ts:32-43`) rather than falling back to mock output.

Impact: production AI outages become user-facing failures instead of degraded-but-valid line-item generation.

Recommended closure:
- Make `AiService` provider orchestration fallback to `MockAiAdapter` after live adapter errors, with telemetry marking degraded mode.
- Add tests for missing key, provider timeout, invalid JSON, and fallback success.

### P1 - Deployment path is incomplete and likely path-fragile

`server/scripts/start-prod.sh` runs `npx prisma migrate deploy --schema=../packages/db/prisma/schema.prisma` then `node dist/index.js` (`server/scripts/start-prod.sh:1-5`). There are no Prisma migrations under `packages/db/prisma/migrations`, no CI workflow, and no root build script. The script path assumes it is executed from `server`, not necessarily from repo root or a production working directory.

Impact: production startup cannot be trusted to migrate and launch consistently.

Recommended closure:
- Commit Prisma migrations.
- Add CI that runs install, Prisma generate, typecheck/build, tests, and migration validation.
- Make production scripts cwd-safe or drive them from root package scripts.

### P2 - Type strictness guardrails are not enforced

The roadmap prohibits `any` usage, but production services/controllers use explicit `any` in quote/invoice line-item mapping, conversion transaction callback, and radar filtering (`server/src/services/billing/conversion.service.ts:31`, `server/src/services/billing/conversion.service.ts:43`, `server/src/services/radar/radar.service.ts:17-21`; also visible in quote and invoice controllers). The workspace build is not currently runnable, so TypeScript strictness cannot be verified locally.

Impact: shared contract drift can hide real runtime shape errors in financial and tenant-scoped paths.

Recommended closure:
- Replace `any` with Prisma transaction client and inferred line item types.
- Add ESLint rules for `@typescript-eslint/no-explicit-any`.
- Make typecheck a required CI gate.

### P2 - Radar performance/indexing is underbuilt

The architecture calls for heavy indexing on `status`, `createdAt`, and `dueDate` for radar queries (`CQ-ARCHITECTURE.md:52-56`). The schema primarily indexes `businessId`; invoices do not have compound indexes for `(businessId, status, dueDate)`, and quotes do not have `(businessId, status)` (`packages/db/prisma/schema.prisma:50-67`, `packages/db/prisma/schema.prisma:86-105`).

Impact: radar queries can become slow as tenant data grows.

Recommended closure:
- Add compound indexes that match radar query predicates.
- Add pagination/limits to radar responses.
- Consider materialized insight state if the rules grow.

### P2 - Observability/audit trail is partial

The architecture describes full activity logs and AI telemetry (`CQ-ARCHITECTURE.md:123-125`). Only AI requests and quote conversion write audit-style records. Client, quote, invoice, payment, reminder, and auth operations do not record activity logs.

Impact: production support and financial auditability are incomplete.

Recommended closure:
- Add a centralized activity logger.
- Emit activity records for create/update/delete/status transitions and payment/reminder events.
- Include authenticated user ID where available.

### P2 - README and setup documentation are insufficient

`README.md` only contains the project title. There is no setup path for installing dependencies, configuring environment variables, generating Prisma client, creating/migrating the database, running tests, or starting production.

Impact: new operators or CI cannot bootstrap the repo reliably from tracked docs.

Recommended closure:
- Expand README with local setup, required Node/npm versions, environment variables, database setup, scripts, and smoke-test commands.
- Document the current MVP boundaries honestly.

## Validation Notes

Commands run from `C:\dev\CashQuote`:

- `rtk git status --short --branch`: clean on `main...origin/main`.
- `rtk npm test`: exits 0 but only prints `Error: no test specified`.
- `rtk npm run build`: fails because root `build` script is missing.
- `rtk npm run build --workspace server`: fails because `tsc` is not found.
- `rtk npm run build --workspace packages/db`: fails because `tsc` is not found.
- `rtk npm run build --workspace packages/shared`: fails because `tsc` is not found.
- `rtk npx jest --runInBand`: failed because `npx` attempted to fetch Jest from npm and network/cache access was blocked; there is no local `node_modules` directory.

## Suggested Next Fix Order

1. Make the repo executable: install/bootstrap docs, root scripts, Prisma generate, build, and Jest test command.
2. Close tenant authorization: user-business membership schema, middleware enforcement, and route-level cross-tenant tests.
3. Remove production secret fallback and add `.env.example`.
4. Commit migrations and CI.
5. Add missing product surfaces: client app/export, payments, reminders/email, and AI degraded fallback.
6. Harden conversion idempotency with database constraints.
7. Replace `any`, add lint/type gates, and broaden integration/e2e/security test coverage.
