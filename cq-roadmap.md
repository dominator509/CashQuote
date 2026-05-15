# BUILD_ROADMAP.md

## 1. ROADMAP SUMMARY
This document outlines the exact, sequential engineering blueprint for the **QuoteCash Invoice Copilot**. The product is a multi-tenant, high-integrity SaaS application designed to streamline billing workflows via an AI-assisted pipeline, targeting Node.js/Express, React/Vite, and PostgreSQL via Prisma. Google Jules will execute this build by functioning as an autonomous delivery agent, strictly managing state transitions through sequential development checkpoints. The execution path prioritizes atomic commits, uncompromising tenant isolation (`businessId` scoping), and defensive architecture to prevent revenue leakage and logic risks.

## 2. JULES DEVELOPMENT PRINCIPLES
- **Small, Verified Patches:** Every commit must represent a single, atomic logical unit. Code will not be staged until the associated unit and integration test suite compiles and passes locally.
- **Strict Type Boundaries:** The use of `any`, `unknown` (without narrowing), or `@ts-ignore` is strictly prohibited. Data flow contracts across the Gateway (Express) and Client (React) must be strictly typed using shared interfaces and Zod schemas.
- **Fail-Safe Ingestion:** All external payloads—whether from the client UI or external LLM providers—must be aggressively validated against runtime schemas before memory allocation or database interaction.
- **Secret Hygiene:** Absolute prohibition of hardcoded mock keys, secrets, or database URIs. All sensitive configurations must be gated behind `dotenv` environment variables with a tracked `.env.example` file.
- **Deterministic Multi-Agentic Workflows:** When constructing AI or heuristic orchestration logic, Jules must implement provider-agnostic adapter patterns that enforce strict JSON output formatting to neutralize prompt injection and non-deterministic logic failures.

## 3. RECOMMENDED REPOSITORY STRUCTURE
```text
/quotecash-monorepo
├── /client                 # React + Vite + Tailwind application
│   ├── /src
│   │   ├── /components     # UI building blocks
│   │   ├── /hooks          # State management and API fetching
│   │   ├── /pages          # Route-level components
│   │   ├── /services       # API client adapters
│   │   └── /styles         # Tailwind and Print CSS (PDF prep)
├── /server                 # Node.js + Express backend
│   ├── /src
│   │   ├── /controllers    # HTTP route handlers
│   │   ├── /middlewares    # Auth, RBAC, and businessId injection
│   │   ├── /services       # Core business logic and external adapters
│   │   │   ├── /ai         # AI Copilot engine adapters
│   │   │   └── /billing    # Financial math and entity state machines
│   │   ├── /utils          # Math helpers, strict loggers
│   │   └── index.ts        # App instantiation
├── /packages
│   ├── /db                 # Prisma schema and generated client
│   │   ├── prisma/schema.prisma
│   │   └── /migrations
│   └── /shared             # Shared TS types and Zod schemas
├── /tests
│   ├── /unit               # Isolated function testing (Math, logic)
│   ├── /integration        # Database and API flow testing
│   ├── /e2e                # End-to-end user flows
│   └── /security-audits    # Automated red and blue team audit scripts
├── package.json
└── tsconfig.base.json
```

## 4. BUILD PHASES OVERVIEW

| Phase ID | Phase Name | Target Deliverables | Core Dependencies | Jules Security Audit Level |
| :--- | :--- | :--- | :--- | :--- |
| **01** | Environment & Repo Initialization | Monorepo scaffolding, TS configs, Linter setup | Node, pnpm/npm, TypeScript | Low |
| **02** | Database Schema & ORM Generation | Prisma schema, initial migration, DB client | PostgreSQL, Prisma | High |
| **03** | Core Auth & Tenant Isolation | Demo-login API, RBAC middleware, JWT scaffolding | Express, Zod | High |
| **04** | Core Business Logic Engine | CRUD APIs for Clients, Quotes, Invoices | Phase 02, Phase 03 | High |
| **05** | AI Copilot Engine & Adapters | `IAIService`, Mock AI Fallback, LLM integration | Phase 04, external LLM SDK | Medium |
| **06** | Financial State & Lost Cash Radar | Conversion APIs, Reminder chron logic | Phase 04 | High |
| **07** | Frontend Client Foundation | React router, API hooks, UI scaffolding | Phase 01 | Low |
| **08** | Security Auditing & Deployment | Red/Blue team tests, CI/CD, Prisma deploy scripts | Phase 01-07 | High |

---

## 5. DETAILED PHASE SPECIFICATIONS

### Phase 01: Environment & Repo Initialization
- **Goal:** Establish a deterministic, strongly-typed monorepo environment that acts as the foundation for the client, server, and shared packages.
- **Deliverables:** `package.json` workspaces, `tsconfig.json` configurations, ESLint/Prettier setups, and the baseline folder structure.
- **Files/Folders Affected:** `/package.json`, `/tsconfig.base.json`, `/client/vite.config.ts`, `/server/tsconfig.json`, `/packages/shared/package.json`.
- **Step-by-Step Implementation Tasks:**
  1. Initialize the root monorepo using npm/pnpm workspaces.
  2. Scaffold the Vite React application in `/client`.
  3. Scaffold the Express TypeScript application in `/server`.
  4. Create the `/packages/shared` directory for cross-boundary types.
  5. Configure ESLint to enforce strict typing and ban `any`.
- **Acceptance Criteria:** `npm run build` successfully compiles all three workspaces without a single TypeScript or linting error.
- **Automated Validation & Tests:** Write a basic assertion script in `/tests/unit/env.test.ts` to verify workspace module resolution.
- **Security & Isolation Checks:** Ensure no `.env` files are tracked in version control by generating an exhaustive `.gitignore`.
- **Common Failure Modes:** Workspace symlink failures, conflicting TypeScript target modules between Node and Vite.
- **Anti-Drift Notes:** Do not install unnecessary dependencies; restrict to React, Vite, Express, Prisma, and Zod.

### Phase 02: Database Schema & ORM Generation
- **Goal:** Implement an ACID-compliant relational schema capable of enforcing tenant isolation natively at the query level.
- **Deliverables:** A complete `schema.prisma` file containing all entities defined in the architecture document.
- **Files/Folders Affected:** `/packages/db/prisma/schema.prisma`, `/packages/db/package.json`.
- **Step-by-Step Implementation Tasks:**
  1. Define `User`, `Business`, and `Client` models.
  2. Define `Quote` and `QuoteLineItem` models, enforcing foreign key relationships and cascade rules.
  3. Define `Invoice`, `InvoiceLineItem`, and `Payment` models.
  4. Define `Reminder`, `AiRequest`, and `ActivityLog` models for observability.
  5. Inject `businessId` as an indexed column on EVERY model except `User`.
  6. Generate the Prisma client and apply the first migration.
- **Acceptance Criteria:** `prisma migrate dev` executes successfully against a local Postgres instance, and the client generates without warnings.
- **Automated Validation & Tests:** Create `/tests/integration/db.test.ts` to verify CRUD operations and foreign key constraints on the generated client.
- **Security & Isolation Checks:** Verify cascading deletes do not inadvertently wipe cross-tenant data. Ensure `businessId` indexes are in place to prevent full table scans.
- **Common Failure Modes:** Missing reverse relation definitions in Prisma; using floating-point types (`Float`) instead of `Int` (cents) or `Decimal` for financial math.
- **Anti-Drift Notes:** The schema is the absolute source of truth. Jules must not modify this schema in later phases without running a dedicated migration checkpoint.

### Phase 03: Core Auth & Tenant Isolation
- **Goal:** Construct an ironclad authorization gateway that intercepts all incoming API traffic and enforces workspace boundaries.
- **Deliverables:** Demo-login authentication endpoints, session validation middleware, and the `requireBusinessId` middleware.
- **Files/Folders Affected:** `/server/src/middlewares/auth.ts`, `/server/src/middlewares/tenant.ts`, `/server/src/controllers/auth.controller.ts`.
- **Step-by-Step Implementation Tasks:**
  1. Implement `/api/auth/demo-login` which mints a secure HTTP-only session token (JWT or session store).
  2. Create standard authentication middleware to verify tokens and attach `req.user`.
  3. Create tenant-scoping middleware that extracts `businessId` from the route parameters or headers and validates the user's RBAC permissions.
  4. Build generic Express error handlers (401, 403, 500).
- **Acceptance Criteria:** Any request to a protected `/api/*` route lacking a valid token or a validated `businessId` immediately returns a 401 or 403.
- **Automated Validation & Tests:** Write `/tests/unit/auth.middleware.test.ts` simulating valid and invalid request contexts.
- **Security & Isolation Checks:** Prevent Insecure Direct Object Reference (IDOR) by mathematically ensuring the authenticated user owns the requested `businessId`.
- **Common Failure Modes:** Leaking stack traces in 500 errors; asynchronous middleware failing to call `next()`.
- **Anti-Drift Notes:** This middleware layer is immutable once written. All future routes must explicitly pass through it.

### Phase 04: Core Business Logic Engine
- **Goal:** Build the financial CRUD APIs with deterministic, server-side math calculations to prevent client-side manipulation.
- **Deliverables:** API routes and service logic for Clients, Quotes, and Invoices.
- **Files/Folders Affected:** `/server/src/routes/*`, `/server/src/controllers/*`, `/server/src/services/billing/*`.
- **Step-by-Step Implementation Tasks:**
  1. Create `Client` CRUD endpoints.
  2. Create `Quote` CRUD endpoints, integrating a shared financial math utility to calculate line item subtotals, apply taxes, and enforce final totals.
  3. Create `Invoice` CRUD endpoints with identical math validation.
  4. Ensure every single Prisma query utilizes `where: { businessId: req.business.id }`.
- **Acceptance Criteria:** A full API cycle (Create Client -> Create Quote -> Update Line Items) works perfectly, with all totals dynamically calculated and saved to the database.
- **Automated Validation & Tests:** Write `/tests/unit/math.test.ts` to strictly verify subtotal/tax/discount algorithms. Write `/tests/integration/quote.test.ts` to verify database persistence.
- **Security & Isolation Checks:** Enforce strict Zod payload validation to prevent SQL injection or mass-assignment vulnerabilities.
- **Common Failure Modes:** Floating-point precision errors (e.g., $10.00 * 0.08 tax = 0.8000000001). MUST use integer cents.
- **Anti-Drift Notes:** Do not trust any `total` value sent by the client payload. The server must recalculate all financial data.

### Phase 05: AI Copilot Engine & Adapters
- **Goal:** Implement the multi-agentic workflows that translate rough unstructured notes into standardized financial line items using the internal logic of Large Language Models.
- **Deliverables:** An `IAIService` interface, an LLM Provider Adapter, a deterministic Mock Adapter, and the generation API route.
- **Files/Folders Affected:** `/server/src/services/ai/ai.service.ts`, `/server/src/services/ai/mock.adapter.ts`, `/server/src/controllers/ai.controller.ts`.
- **Step-by-Step Implementation Tasks:**
  1. Define the TypeScript interface `IAIService` with a method `generateLineItems(notes: string)`.
  2. Implement `MockAiAdapter` that uses regex or static timeouts to return pre-formatted JSON line items (for offline dev/testing).
  3. Implement the live LLM Adapter, establishing system prompts that enforce strict JSON schema adherence to mitigate non-deterministic output.
  4. Create the POST `/api/ai/generate` route.
  5. Log the request parameters to the `ai_requests` telemetry table.
- **Acceptance Criteria:** Supplying a string like "5 hours of dev work at 100 an hour" reliably returns a structured JSON array `[{ description: "Development Work", quantity: 5, price: 10000 }]`.
- **Automated Validation & Tests:** Write `/tests/unit/ai.mock.test.ts` to verify the adapter pattern cleanly switches based on environment variables.
- **Security & Isolation Checks:** Sanitize all user input sent to the LLM to prevent Prompt Injection vectors.
- **Common Failure Modes:** The LLM hallucinates keys, returns markdown blocks instead of raw JSON, or the API times out without a fallback.
- **Anti-Drift Notes:** The fallback architecture is mandatory. If the AI key is missing, the system must seamlessly degrade to the `MockAiAdapter`.

### Phase 06: Financial State & Lost Cash Radar
- **Goal:** Implement proactive revenue recovery by mapping database states against time-based heuristics and atomic state transitions.
- **Deliverables:** Quote-to-Invoice conversion transaction logic, and the "Lost Cash" query service.
- **Files/Folders Affected:** `/server/src/services/billing/conversion.service.ts`, `/server/src/services/radar/radar.service.ts`.
- **Step-by-Step Implementation Tasks:**
  1. Write a Prisma interactive transaction (`$transaction`) that marks a Quote as 'Accepted' and instantly provisions a duplicate Invoice.
  2. Develop the Radar service queries: finding Quotes accepted but not invoiced, and finding Invoices past their `dueDate` without recent `reminders`.
  3. Create an API endpoint `/api/radar/insights` to serve these actionable items.
- **Acceptance Criteria:** A Quote successfully converts to an Invoice atomically. If either step fails, the entire database transaction rolls back safely.
- **Automated Validation & Tests:** Write `/tests/integration/conversion.test.ts` simulating a database crash mid-conversion to ensure atomic rollback.
- **Security & Isolation Checks:** Ensure the Radar query engine strictly partitions insights by `businessId`.
- **Common Failure Modes:** Orphaned line items during conversion; deadlocks on high-concurrency transactions.
- **Anti-Drift Notes:** All status changes must be mapped to the `activity_logs` table to maintain an immutable audit trail.

### Phase 07: Frontend Client Foundation
- **Goal:** Build the user interface to consume the APIs, map states, and generate exportable documents.
- **Deliverables:** React routes, Zod-validated forms, API hooks, and the Print CSS layout.
- **Files/Folders Affected:** `/client/src/pages/*`, `/client/src/hooks/*`, `/client/src/styles/print.css`.
- **Step-by-Step Implementation Tasks:**
  1. Scaffold the Dashboard, Quote Builder, and Invoice Viewer pages.
  2. Implement the AI Copilot input field and loading state logic.
  3. Wire up the forms using React Hook Form and the shared Zod schemas from `/packages/shared`.
  4. Develop the Document Export view utilizing `@media print` CSS for pixel-perfect PDF rendering via `window.print()`.
- **Acceptance Criteria:** The user can log in (demo), create a quote via AI, edit it, accept it, view the invoice, and trigger a print dialog that hides UI navigation and shows a clean document.
- **Automated Validation & Tests:** Write `/tests/e2e/workflow.spec.ts` using Playwright or Cypress to automate the critical path.
- **Security & Isolation Checks:** Ensure React router guards are in place so unauthenticated users cannot view dashboard routes.
- **Common Failure Modes:** Print CSS failing to break pages correctly on long line-item lists; state desync between the UI totals and server totals.
- **Anti-Drift Notes:** UI components must strictly consume the data types defined in `/packages/shared`.

### Phase 08: Security Auditing & Deployment
- **Goal:** Finalize production readiness by executing comprehensive security testing protocols to map execution paths, logic risks, and failure modes.
- **Deliverables:** Automated red and blue team test scripts, production build pipelines, and final deployment configurations.
- **Files/Folders Affected:** `/tests/security-audits/*`, `/.github/workflows/deploy.yml` (or Replit equivalent), `package.json`.
- **Step-by-Step Implementation Tasks:**
  1. Author automated blue team scripts to verify all endpoints reject cross-tenant data requests.
  2. Author automated red team fuzzing scripts to attempt SQL injection, Prompt Injection, and mass-assignment attacks against the API.
  3. Audit all 25+ API execution paths to ensure predictable error handling and logging.
  4. Create deployment scripts that run `prisma migrate deploy` and compile both Node and React environments.
- **Acceptance Criteria:** All security audits pass with zero vulnerabilities. The system cleanly builds and starts up using `npm run start:prod`.
- **Automated Validation & Tests:** Execution of the full `/tests` directory yields 100% pass rates across Unit, Integration, E2E, and Security suites.
- **Security & Isolation Checks:** Final environment variable check. Ensure `NODE_ENV=production` is set and stack traces are suppressed.
- **Common Failure Modes:** Production database failing to migrate due to drift; missing environment variables causing silent crashes in the AI adapter.
- **Anti-Drift Notes:** No code mutations are allowed in this phase—only configuration, telemetry hardening, and testing.

---

## 6. CODING AGENT OPERATING RULES (FOR JULES)
1. **Look Before You Leap:** Read full structural files and sibling module dependencies completely before performing text replacements or code injections. Understand the execution path holistically.
2. **Preserve Testing Footprints:** Never truncate, delete, or comment out passing test suites to mask a compiling error or compilation mismatch. Tests are the immutable contract.
3. **No Invisible Failures:** Avoid swallowing exceptions in empty catch blocks. All errors must be typed, logged cleanly to the console (or telemetry service), and returned as structured HTTP responses.
4. **Deterministic Mocks First:** When interacting with the AI logic or simulated Email logic, always construct and verify the deterministic local mock layer before wiring the live connector.
5. **Mandatory Guardrail Execution:** Prior to any database query generation, you must logically verify: *Is `businessId` explicitly defined in the `where` clause?* If not, halt and rewrite.

## 7. DEFINITION OF DONE (DoD)
Before marking any task, block, or Phase complete, Jules must verify:
- Zero active linting errors, TypeScript `any` violations, or compilation faults in both `/client` and `/server`.
- 100% test execution coverage across all modified or newly created code modules.
- The Security Engine verifies zero secret leakage, and confirms no unprotected API endpoints exist outside of the demo-login.
- A concise, chronological architectural update is permanently recorded within the repository's `CHANGELOG.md`.
