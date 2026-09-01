# CashQuote Private Pilot Production Readiness

## Launch Target

CashQuote is ready for a controlled private pilot when `npm run validate:prod` passes against a fresh PostgreSQL database and the deployment environment provides the required production variables.

This launch target is not full public SaaS v1. Payments remain internal records only, and email uses SMTP reminder sending only.

## Required Production Environment

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`
- `APP_ORIGIN`
- `PILOT_EMAIL_ACCESS_CODES` (JSON object of per-email private pilot codes)
- `SMTP_URL`
- `SMTP_FROM`
- `PORT` (optional; defaults to `3000`)
- `CORS_ORIGIN` (optional; defaults to `APP_ORIGIN`)
- `PILOT_EMAIL_ALLOWLIST` (optional; recommended for a private pilot)
- `OPENAI_API_KEY` when live AI is desired
- `LOG_LEVEL` (optional; defaults to the logger's configured level)
- `TRUST_PROXY=true` only when the service is behind exactly one trusted proxy/load balancer hop

`APP_ORIGIN` and every `CORS_ORIGIN` entry must be an exact HTTP(S) origin, not a wildcard, path, or malformed URL. `JWT_SECRET` must be a private value of at least 32 characters and must not use a documented placeholder or development default. `PILOT_EMAIL_ACCESS_CODES` must be valid JSON containing at least one email key and a private, non-default code of at least 16 characters for each pilot identity. The email supplied at login must match one of those configured identities; the local/test-only `PILOT_ACCESS_CODE` is not accepted in production. `ALLOW_DEMO_LOGIN=true` is permitted only for an explicitly controlled private pilot; `ALLOW_MOCK_EMAIL=true` is rejected in production. Leave `TRUST_PROXY` unset or `false` unless the deployment topology has exactly one trusted proxy hop. Production startup and `/readyz` require a valid SMTP URL and sender email configuration.

## Validation Gate

Run the full local gate:

```bash
npm run validate:prod
```

The gate runs lint, typecheck, build, Prisma migrations, unit tests, integration tests, security tests, the PostgreSQL concurrency smoke, high-severity npm audit, production smoke, and Playwright e2e.

For a faster pre-commit check:

```bash
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:security
npm run test:concurrency
```

## Production Start

```bash
npm run build
npm run start:prod
```

`start:prod` forces `NODE_ENV=production`, applies Prisma migrations, and starts the built Express server. In production, Express serves both `/api/*` and the built React app from `client/dist`.

## Docker

```bash
docker build -t cashquote:private-pilot .
docker run --env-file .env -p 3000:3000 cashquote:private-pilot
```

After startup:

```bash
curl http://localhost:3000/healthz
curl http://localhost:3000/readyz
```

## Smoke Flow

1. Open the app.
2. Pilot login with an email configured in `PILOT_EMAIL_ACCESS_CODES` and that identity's private code.
3. Create a client.
4. Create an accepted quote.
5. Convert the quote to an invoice.
6. Record an internal payment.
7. Create, send, and resolve a reminder.
8. Print the invoice.

## Rollback

1. Stop the current service.
2. Deploy the previous image or commit.
3. Do not roll back database migrations automatically.
4. If a migration must be reversed, create a forward corrective migration after inspecting production data.
5. Verify `/readyz` and the smoke flow after rollback.

## Runtime Checks

- `GET /healthz`: process liveness.
- `GET /readyz`: production env, SMTP configuration, and database readiness.
- Structured logs include request IDs, method, path, status, duration, user ID, and business ID when available.
- Production errors return stable `code` values and do not expose stack traces.
