# Local Production Validation Evidence

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
