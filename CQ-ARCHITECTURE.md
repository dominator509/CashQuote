# ARCHITECTURE.md

## 1. Product Summary
**QuoteCash Invoice Copilot** is a production-minded SaaS application designed to help freelancers, contractors, agencies, creators, and small businesses optimize their billing workflows. The application accelerates the creation of quotes and invoices by leveraging AI to translate rough job notes into clean, professional line items. Furthermore, it actively prevents revenue leakage through a proprietary "Lost Cash Radar," ensuring timely follow-ups on draft quotes, unpaid invoices, and stagnant client relationships.

## 2. Core Product Vision
The long-term vision for QuoteCash is to become an enterprise-grade financial operations hub for small-to-medium businesses. The current MVP establishes a high-performance, strongly-typed foundation capable of scaling into a high-TPS, multi-tenant environment. The architecture strictly enforces data isolation via workspace (`businessId`) scoping, ensuring that as the platform grows to support complex enterprise workflows, multi-currency processing, and high-volume API access, the core data integrity and security posture remain uncompromised.

## 3. Target Users
1. **Owner / Admin:** Owns the business workspace (`businessId`). Has full CRUD permissions over clients, quotes, invoices, global settings, team management, and financial reporting.
2. **Team Member:** Subordinate role with scoped access. Can create and edit quotes and invoices, but cannot alter global business settings or delete top-level entities.
3. **Client Portal User (Future-Proofing):** A read-only or interaction-limited role intended for end-clients to view, accept, and pay invoices. Schema and routing must be structured to accommodate this role securely in V2 without architectural rewrites.

## 4. Key Use Cases & Workflows
1. **Onboarding:** User authenticates and provisions a `Business Profile` (name, placeholder logo, defaults).
2. **Client Management:** User securely stores client metadata (contact info, billing address, tags).
3. **AI-Assisted Quoting:** User inputs rough, unstructured job notes. The system routes this to the AI service, which returns structured line items (description, quantity, price, category) with confidence scores.
4. **Quote Lifecycle:** User edits AI-generated items, applies taxes/discounts, and tracks status (Draft -> Sent -> Accepted -> Rejected).
5. **Invoice Conversion:** With atomic database transactions, an accepted quote is converted into an active invoice.
6. **Lost Cash Prevention:** The system continuously evaluates database state against time-based rules to populate the "Lost Cash Radar" (e.g., accepted quotes lacking invoices, overdue invoices lacking reminders).
7. **Document Export:** Users can view a cleanly formatted HTML version of the quote/invoice and export it to PDF.

## 5. Feature Architecture

### 5.1 Authentication, Account & Workspace Management
* **Purpose:** Secure identity verification and tenant isolation.
* **Responsibilities:** Session management, demo-login abstraction, business context resolution.
* **Data Entities:** `users`, `businesses`.
* **Security:** Cryptographic session tokens, strict enforcement of `businessId` in all subsequent API calls.
* **Failure Modes:** Missing auth tokens, expired sessions. Fallback to clean 401/403 errors with frontend redirects.

### 5.2 Role-Based Access Control (RBAC) & Permissions
* **Purpose:** Ensure users only access authorized data.
* **Responsibilities:** Middleware validation of user roles against resource requirements.
* **Data Entities:** Derived from `users.role` (future implementation, but architecture must support middleware interception now).
* **Logic Risks:** Cross-tenant data leakage. Mitigated by a rigid rule: *No database query executes without a `where: { businessId }` clause*.

### 5.3 Core Business Logic Engine (Billing & CRM)
* **Purpose:** Handle the financial entities and their state machines.
* **Responsibilities:** CRUD for clients, quotes, and invoices; calculating complex totals (subtotal, tax, discount, total); state transitions.
* **Data Entities:** `clients`, `quotes`, `quote_line_items`, `invoices`, `invoice_line_items`, `payments`.
* **Failure Modes:** Floating-point precision errors in financial math.
* **Logic Risks:** Mitigate by calculating line item totals and aggregate totals strictly on the server-side before database commits.

### 5.4 AI Copilot Engine
* **Purpose:** Translate human chaos (notes) into structured financial data (line items).
* **Responsibilities:** Interfacing with external LLM providers, standardizing outputs via strict JSON schemas, providing reliable fallbacks.
* **Data Entities:** `ai_requests` (for auditing/rate limiting).
* **Failure Modes:** LLM hallucination, API timeout, missing API keys.
* **Logic Risks:** Mitigated by the **Provider-Agnostic Adapter Pattern** and a robust **Mock AI Fallback** that guarantees valid application state even if the external service fails.

### 5.5 Lost Cash Radar & Reminders
* **Purpose:** Proactive revenue recovery.
* **Responsibilities:** Running heuristic rules against the database (e.g., `status = 'accepted' AND invoiceId IS NULL`).
* **Data Entities:** `reminders`, cross-referencing `quotes` and `invoices`.
* **Security/Performance:** These queries can become expensive. Must be heavily indexed on `status`, `createdAt`, and `dueDate`.

## 6. Recommended Tech Stack
* **Frontend:** React + Vite + Tailwind CSS.
* **Backend:** Node.js + Express.
* **Database:** PostgreSQL.
* **ORM:** Prisma.
* **Auth:** Secure session-ready abstraction with a mock login `/api/auth/demo-login`.
* **PDF Generation:** Server-side HTML-to-PDF OR client-side `window.print()` with robust print CSS.

## 7. System Architecture Overview
The system uses a traditional Client-Server model with a focus on business-scoped data isolation.

* **Client (React/Vite):** Handles UI and state management.
* **Gateway (Express/Node):** Middleware-driven authorization and business logic execution.
* **Data (PostgreSQL/Prisma):** ACID-compliant persistence.
* **External:** Modular adapters for AI and Email services.

## 8. External Integrations & API Adapters
- **AI Service Adapter (`IAIService`):** Interface for generating line items with a mock fallback mechanism.
- **Email Service Adapter (`IMailService`):** V1 utilizes a `MockMailService` logging to console and updating reminder status.

## 9. Advanced Security Architecture
- **Tenant Isolation:** Mandatory `businessId` filtering on all DB queries.
- **Prompt Injection Defense:** Strict JSON output formatting for LLMs.
- **Secret Management:** Strict reliance on `.env` for credentials.
- **Input Validation:** All financial inputs re-validated on the server.

## 10. Database Architecture
Complete relational schema including:
- **users**, **businesses**, **clients**
- **quotes** & **quote_line_items**
- **invoices**, **invoice_line_items**, & **payments**
- **reminders**, **ai_requests**, & **activity_logs**

## 11. API Architecture
Restful API structure with routes for:
- Auth/Demo
- Business & Client management
- Quotes (CRUD + Conversion)
- Invoices (CRUD + Payments)
- AI Generation
- Dashboard & Activity metrics

## 12. Frontend / Client Architecture
- **Routing:** React Router.
- **State:** React Hooks + Service Layer.
- **Print Views:** Dedicated Print CSS for professional document generation.

## 13. Error Handling, Reliability, and Failure Modes
- **Financial Math:** Use cents/integers or Decimal types to avoid floating-point errors.
- **AI Fallback:** Graceful fallback to manual entry or mock data if API fails.
- **Atomic Actions:** Use Prisma transactions for quote-to-invoice conversions.

## 14. Testing Architecture
- **Math Verification:** Unit tests for totals/tax/discount logic.
- **Security:** Verification of tenant boundary enforcement.
- **Integration:** Automated tests for the conversion workflow.

## 15. Upgradeability and Maintainability
- Modular folder structure separating Controllers, Services, and Routes.
- Strict TypeScript/JSDoc interfaces shared between client and server.

## 16. Deployment & CI/CD Architecture
- **Replit Target:** Automated schema pushes via Prisma on startup.
- **Environment Variables:** Documented in `.env.example`.

## 17. Observability and Analytics
- Full audit trail via `activity_logs`.
- AI request telemetry via `ai_requests`.

## 18. Build Risk Register
- Financial precision risks.
- AI non-deterministic output risks.
- PDF environment compatibility.

## 19. Production Readiness Checklist
- Prisma migrations checked.
- Multi-tenancy isolation verified.
- Print styles confirmed.
- AI fallback validated.

## 20. Google Jules Guardrails
1. **Always** include `businessId` in queries.
2. **Never** hardcode secrets.
3. **Always** use atomic commits.
4. **Ensure** AI mock works without keys.
