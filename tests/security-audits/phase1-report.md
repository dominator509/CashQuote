# Phase 1: Reconnaissance, Threat Modeling, and Secrets

## Automated Threat Modeling (STRIDE)
- **Spoofing**: Mitigated via JWT-based authentication and strict HttpOnly/Secure cookies.
- **Tampering**: Blocked via strict Zod server-side validation and Prisma typing.
- **Repudiation**: Addressed via immutable `activity_logs` tracking quote-to-invoice conversions.
- **Information Disclosure**: Mitigated via global error handlers stripping stack traces and mandatory `businessId` scoping.
- **Denial of Service**: AI routes are currently un-rate-limited (Risk logged for future remediation).
- **Elevation of Privilege**: Role checking is stubbed; currently relies on `businessId` scoping to prevent horizontal escalation.

## Secrets Scanning Results
Executed `grep -rn "API_KEY\|SECRET" .` across the repository.
- **Findings**:
  - `JWT_SECRET`: Uses `process.env.JWT_SECRET` with a documented fallback (`fallback-secret-do-not-use-in-prod`) for the demo MVP. In production, `NODE_ENV=production` should enforce the presence of a real secret.
  - `OPENAI_API_KEY`: Strictly sourced from `process.env`. No hardcoded LLM keys exist in the repository.

**Status**: PASSED. No critical hardcoded secrets exposed in the repository.
