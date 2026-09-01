# Production MVP Remediation Closure

Date: 2026-08-31

This note maps the audit findings in `PRODUCTION_FUNCTIONALITY_AUDIT_BRIEFING.md` to the remediation work implemented for the Production MVP target.

## August 31 Audit Follow-Up

The subsequent pre-ship audit findings AUD-001 through AUD-003 and AUD-005 through AUD-010 were addressed in the repository. AUD-004 is closed for repository CI evidence on source-code hardening SHA `2c6556389cf5cad301fcd96a1e222dbf730acc9a`: GitHub Actions run 33469630384 passed the Docker image build and boot/readiness check, concurrency smoke, production smoke, dependency audit, the full Jest gate, and the four-test E2E gate. The same source update also binds production pilot credentials to configured emails, redacts session headers from request logs, bounds readiness-probe traffic, and removes client addresses from mock-mail logs. Local SMTP-capture and PostgreSQL concurrency checks pass, including the complete reminder path from client lookup through sent-state persistence. Real provider SMTP acceptance, deployment-topology validation, branch protection, and Git-history secret-scan evidence remain deployment or repository-administration gates before public release.

## Closed Or Addressed Findings

- Tenant authorization: added `BusinessMember`, demo membership provisioning, and membership enforcement in tenant middleware.
- JWT fallback: removed production fallback behavior through `getJwtSecret`; production now fails closed when `JWT_SECRET` is missing.
- Build/test entrypoints: added root `build`, `typecheck`, `test`, `test:unit`, Prisma, and production start scripts.
- Frontend/export: added a minimal React/Vite/Tailwind client with demo login, quote/invoice/payment/reminder/radar workflows, and print output.
- Payments: added nested invoice payment APIs with overpayment rejection and invoice status recomputation.
- Reminders/email: added client-addressed SMTP delivery, non-production mock mail, due-time enforcement, atomic sending claims, and active-reminder uniqueness.
- Conversion idempotency: added `Invoice.sourceQuoteId @unique` and moved idempotency into the conversion transaction path.
- AI fallback: added fallback orchestration that returns mock output when OpenAI is unavailable or fails.
- Deployment path: added Prisma migration SQL, cwd-safe fail-closed production scripts, OpenSSL runtime support, and GitHub Actions CI.
- Type strictness: added ESLint `no-explicit-any` enforcement and removed production explicit `any` usage.
- Radar indexing and balances: added quote and invoice compound indexes for radar predicates and calculate overdue risk from outstanding payment-adjusted balances.
- Financial concurrency: moved client deletion, quote/invoice creation, payment, invoice, reminder, quote deletion, quote update, and quote conversion mutations onto serializable transactions with retry handling.
- Financial range safety: shared contracts cap persisted line-item subtotals, line-item counts, discounts, and payment amounts to the existing PostgreSQL `INTEGER` range.
- AI contract alignment: validated generated line items against the canonical shared persistence schema and require a non-empty generated result.
- Production configuration: production readiness now requires valid SMTP configuration, rejects mock email, validates proxy configuration, and does not trust forwarded client addresses unless explicitly configured.
- Secret hygiene: ignored local environment files and generated validation artifacts.
- Observability: added centralized activity logging and audit events for core MVP actions.
- Documentation: expanded README and added `.env.example`.

## Remaining Intentional MVP Boundaries

- Payment provider integration is not included.
- SMTP provider credentials, acceptance, and delivery verification remain deployment responsibilities.
- Frontend is MVP workflow coverage, not full SaaS polish.
