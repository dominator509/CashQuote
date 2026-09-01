# Changelog

## 2026-08-31 — Production MVP hardening

- Corrected reminder delivery to address the associated client's email and
  added recipient validation and SMTP-capture coverage.
- Made reminder timing, active-reminder uniqueness, and delivery claims
  consistent across the API, client, and concurrency checks.
- Corrected Lost Cash Radar to report payment-adjusted outstanding balances.
- Hardened financial mutations with serializable transactions and retry
  handling, including PostgreSQL concurrency smoke coverage.
- Aligned AI-generated line items with the shared persistence schema and
  bounded financial inputs against PostgreSQL integer limits.
- Made production startup and readiness fail closed for missing or invalid
  configuration, unavailable mock email, weak pilot access codes, and failed
  migrations.
- Rejected the documented JWT configuration placeholder in production.
- Required production JWT secrets to be at least 32 characters.
- Added Docker production-image build and boot/readiness checks to CI, plus
  bounded dependency-audit behavior.
- Ignored local environment files and generated validation artifacts.
