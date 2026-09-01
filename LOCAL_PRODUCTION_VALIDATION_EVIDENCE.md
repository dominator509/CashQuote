# Local Production Validation Evidence

The June evidence below is historical and predates the August pre-ship audit remediation. Use the current remediation evidence section at the end of this document for the present working tree; in particular, production now rejects `ALLOW_MOCK_EMAIL=true`.

Run timestamp: 2026-06-24T22:16:58.0910579-07:00

## Environment

- Workspace: `C:\dev\CashQuote`
- Database container: `cashquote-prod-validation-postgres`
- Database image: `postgres:16`
- Database port: `127.0.0.1:55432 -> 5432`
- Database name: `cashquote_validation`
- Production validation env:
  - `DATABASE_URL=postgresql://postgres:REDACTED@127.0.0.1:55432/cashquote_validation`
  - `JWT_SECRET=REDACTED`
  - `APP_ORIGIN=http://127.0.0.1:3100`
  - `CORS_ORIGIN=http://127.0.0.1:3100,http://127.0.0.1:5173`
  - `PILOT_ACCESS_CODE=REDACTED`
  - `PILOT_EMAIL_ALLOWLIST=`
  - `ALLOW_MOCK_EMAIL=true`

## Database Readiness

Command:

```powershell
docker exec cashquote-prod-validation-postgres pg_isready -U postgres -d cashquote_validation
```

Result:

```text
/var/run/postgresql:5432 - accepting connections
```

Migration command:

```powershell
npm.cmd run prisma:migrate
```

Result:

```text
All migrations have been successfully applied.
```

## smoke:prod

Command:

```powershell
npm.cmd run smoke:prod
```

Result:

```text
GET /healthz completed with 200
GET /readyz completed with 200
GET / completed with 200
Production smoke check passed
```

## test:e2e

Command:

```powershell
npm.cmd run test:e2e
```

Result:

```text
Running 2 tests using 1 worker
ok 1 [chromium] tests\e2e\private_pilot.spec.ts:3:5 private pilot workflow reaches invoice print/export
ok 2 [chromium] tests\e2e\private_pilot.spec.ts:57:5 unauthenticated users see the login workflow only
2 passed (2.7m)
```

## validate:prod

Command:

```powershell
npm.cmd run validate:prod
```

Validated stages:

```text
npm run lint
npm run typecheck
npm run build
npm run test:unit
npm run test:integration
npm run test:security
npm audit --audit-level=high
npm run smoke:prod
npm run test:e2e
```

Result:

```text
test:unit: 4 passed, 4 total; 23 passed, 23 total
test:integration: 1 passed, 1 total; 1 passed, 1 total
test:security: 1 passed, 1 total; 9 passed, 9 total
smoke:prod: Production smoke check passed
test:e2e: 2 passed (1.7m)
validate:prod exited with code 0
```

Audit note:

```text
npm audit --audit-level=high exited successfully for the production gate.
The audit output still reported 18 moderate advisories in the Jest dependency chain through js-yaml.
```

## Fixes Applied During Validation

- Repaired `packages/db/prisma/migrations/202606230001_production_mvp/migration.sql` into a full baseline migration so a fresh Postgres database can apply it successfully.
- Updated `playwright.config.ts` to align `APP_ORIGIN` and `CORS_ORIGIN` with the Playwright host `http://127.0.0.1:5173`.
- Fixed async React form handlers in `client/src/App.tsx` by preserving the form element before awaited API calls.
- Tightened Playwright locators in `tests/e2e/private_pilot.spec.ts` so the workflow assertions target the intended client and quote rows.

## Moderate Advisory Closure

Run timestamp: 2026-06-24T22:28:00-07:00

Change:

```text
Added an npm override for js-yaml ^4.2.0 so the Jest/Istanbul coverage path resolves away from vulnerable js-yaml <=4.1.1.
Updated Jest config to exclude tests/e2e from root Jest runs; Playwright remains covered by npm run test:e2e.
```

Resolved dependency path:

```text
cashquote@1.0.0 C:\dev\CashQuote
└─┬ ts-jest@29.4.11
  └─┬ @jest/transform@30.4.1
    └─┬ babel-plugin-istanbul@7.0.1
      └─┬ @istanbuljs/load-nyc-config@1.1.0
        └── js-yaml@4.2.0 deduped
```

Verification:

```text
npm install: found 0 vulnerabilities
npm audit: found 0 vulnerabilities
npm test -- --runInBand: 6 passed, 6 total; 33 passed, 33 total
npm run build: passed
git diff --check: passed
```

## Current Remediation Evidence

Run date: 2026-08-31

The current working tree has passed the following repository-local checks:

```text
typecheck: passed
lint: passed
build: passed
full Jest: 23 suites passed, 118 tests passed
production-like unit Jest: 19 suites passed, 91 tests passed
production-like integration Jest: 2 suites passed, 3 tests passed
production-like security Jest: 2 suites passed, 24 tests passed
SMTP capture integration: 1 test passed
Playwright E2E: 2 tests passed
offline npm audit --audit-level=high: found 0 vulnerabilities
hosted GitHub Actions CI: success for exact SHA 6cc918c (run 33258484205)
```

The live audit command was attempted with the same bounded settings used by the release gate. npm returned `audit endpoint returned an error` from the registry security endpoint; it failed fast rather than hanging. The offline lockfile audit remains clean, and the live registry failure is therefore recorded as unavailable advisory-service evidence, not as a clean hosted dependency result.

A fresh PostgreSQL 16 schema applied both committed migrations successfully. The repository's concurrency smoke then passed under production-like SMTP variables with mock email disabled at the caller:

```text
PostgreSQL concurrency smoke passed: payments, invoice update/payment, invoice delete/payment, conversion, reminder create/send
```

The full `npm run validate:prod` command was also exercised against a fresh schema. The individual repository stages were independently verified under the same production-like environment; the aggregate command's network-backed `npm audit` stage did not complete in the restricted execution environment, so this document does not claim the local aggregate command green. GitHub Actions run 33258484205 subsequently completed green for the exact final remediation SHA, closing the repository CI gate. Real provider SMTP acceptance, Docker production-image boot, deployment proxy topology, branch protection, and Git-history secret scanning remain deployment or repository-administration responsibilities.
