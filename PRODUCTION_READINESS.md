# CashQuote Private Pilot Production Readiness

## Launch Target

CashQuote is ready for a controlled private pilot when `npm run validate:prod` passes against a fresh PostgreSQL database and the deployment environment provides the required production variables.

This launch target is not full public SaaS v1. Payments remain internal records only, and email uses SMTP reminder sending only.

## Required Production Environment

- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `APP_ORIGIN`
- `CORS_ORIGIN`
- `PILOT_ACCESS_CODE`
- `PILOT_EMAIL_ALLOWLIST`
- `SMTP_URL`
- `SMTP_FROM`
- `OPENAI_API_KEY` when live AI is desired
- `LOG_LEVEL=info`
- `TRUST_PROXY=true` when running behind a proxy/load balancer

`APP_ORIGIN` and every `CORS_ORIGIN` entry must be an exact HTTP(S) origin, not a wildcard, path, or malformed URL. `PILOT_ACCESS_CODE` must be a private, non-default value of at least 16 characters. `ALLOW_DEMO_LOGIN=true` and `ALLOW_MOCK_EMAIL=true` should only be used outside production. Production startup and `/readyz` require usable SMTP configuration.

## Validation Gate

Run the full local gate:

```bash
npm run validate:prod
```

The gate runs lint, typecheck, build, unit tests, integration tests, security tests, high-severity npm audit, production smoke, and Playwright e2e.

For a faster pre-commit check:

```bash
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:security
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
2. Pilot login with an allowlisted email and `PILOT_ACCESS_CODE`.
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
