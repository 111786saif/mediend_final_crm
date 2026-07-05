# Mediend Workspace — AI Application Context

> **Purpose:** Master reference for AI assistants working on this codebase. Read this first to understand what the app is, how it is structured, and where to look before making changes.
>
> **Last updated:** July 2026 · **Repo:** `mediend-crm-v2` (Next.js monolith)

---

## 1. What This Application Is

**Mediend Workspace** is an internal **CRM + HRMS + Finance + Operations** platform for Mediend (healthcare / surgery coordination company). It manages:

| Domain | What it does |
|--------|----------------|
| **Sales / BD** | Lead pipeline, KYP, case tracker, targets, team hierarchy |
| **Patient / Case** | Insurance & cash surgery flows from lead → KYP → pre-auth → IPD → discharge → P&L |
| **Insurance** | Pre-authorization, hospital suggestions, cash case review, discharge sheets |
| **P&L** | Profit/loss records, outstanding payments, surgery dashboards |
| **HRMS** | Employees, attendance, leaves, payroll, recruitment, documents |
| **Finance** | Ledger, sales entries, inventory, payroll, P&L reporting |
| **MD / Executive** | MD dashboards, tasks, approvals, compliance, anonymous messages |
| **IT / DM / Loan-Demat** | IT project P&L, digital marketing CPL, loan-demat revenue |
| **Tasks & Meets** | Internal task management, calendar, video meets, work logs |

There is **no separate Patient table** — the **`Lead`** model is the central patient/case entity.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | **Next.js 16** (App Router, `app/` directory) |
| Language | **TypeScript** |
| UI | **React 19**, **Tailwind CSS**, **Radix UI**, **shadcn-style** components in `components/ui/` |
| Data fetching (client) | **TanStack React Query** (`useQuery`, `useMutation`) |
| ORM | **Prisma 7** → PostgreSQL (Supabase) |
| Auth | **JWT** in httpOnly cookie `mediend_session` |
| File uploads | **AWS S3** (prod) · local `public/uploads/` fallback in dev |
| AI | Vercel AI SDK (`@ai-sdk/*`) — chat at `/api/ai/chat` |
| PWA | `@ducanh2912/next-pwa` |
| Package manager | **npm** or **bun** (both used; `npm run dev` is standard) |
| Dev server | `npm run dev` → webpack mode on port **3000** |

**Prisma client output:** `generated/prisma/` (not `node_modules/@prisma/client`).

---

## 3. Repository Layout

```
mediend.workspace/
├── app/                          # Next.js App Router
│   ├── api/                      # ~350 REST API route handlers (route.ts)
│   ├── home/                     # Generic home (/home)
│   ├── md/                       # MD-specific pages
│   ├── hr/                       # HR admin pages
│   ├── employee/                 # Self-service employee portal
│   ├── bd/                       # BD pipeline, case tracker (/bd/kyp)
│   ├── sales/                    # Sales head dashboards & targets
│   ├── team-lead/                # Team lead views
│   ├── executive-assistant/      # EA views (acts as Project Head)
│   ├── patient/[leadId]/         # Patient case hub (main case UI)
│   ├── insurance/                # Insurance team dashboards
│   ├── pl/                       # P&L module
│   ├── finance/                  # Finance module
│   ├── compliance/               # Compliance calls
│   ├── profile/                  # User profile
│   └── login/                    # Auth
├── components/                   # React components by domain
│   ├── ui/                       # Shared UI primitives
│   ├── admission/                # IPD forms, mark IPD
│   ├── kyp/                      # KYP forms
│   ├── targets/                  # Target widgets
│   ├── home/                     # Home page sections
│   └── hr/, md/, pl/, etc.
├── hooks/                        # Client hooks (use-auth, use-leads, etc.)
├── lib/                          # Shared server/client utilities
│   ├── prisma.ts                 # Prisma singleton
│   ├── session.ts                # JWT session read/write
│   ├── rbac.ts                   # Role → permission mapping
│   ├── api-client.ts             # Frontend fetch wrapper
│   ├── api-utils.ts              # successResponse, errorResponse
│   ├── sidebar-nav.ts            # Role-based navigation
│   ├── s3-client.ts              # File upload (S3 + local dev fallback)
│   ├── case-permissions.ts       # Case-stage action permissions
│   ├── analytics/ipd-filters.ts  # Canonical IPD-done counting
│   └── hrms/, finance/, sync/   # Domain helpers
├── prisma/
│   ├── schema.prisma             # Full DB schema (~3200 lines)
│   └── migrations/               # SQL migrations
├── generated/prisma/             # Generated Prisma client (gitignored)
├── docs/                         # Deep-dive documentation
├── scripts/                      # One-off migrations, sync, seed scripts
├── proxy.ts                      # CORS for /api/* routes
└── .env                          # Secrets (never commit)
```

---

## 4. Architecture Patterns

### 4.1 Request flow (typical feature)

```
Browser (React client component)
  → hook (useQuery / useMutation)
    → lib/api-client.ts (apiGet / apiPost / apiPatch)
      → app/api/.../route.ts
        → getSessionFromRequest() — auth
        → hasPermission() / role check — authorization
        → prisma.* — database
        → successResponse(data) / errorResponse(msg, status)
```

### 4.2 Page structure

- Most pages are **`'use client'`** components.
- Wrapped by **`components/authenticated-wrapper.tsx`** (sidebar, bottom nav, auth guard).
- **`components/protected-route.tsx`** redirects unauthenticated users to `/login`.
- Navigation is **role-filtered** via `lib/sidebar-nav.ts` + `components/app-sidebar.tsx`.

### 4.3 API conventions

```typescript
// Standard response shape
{ success: true, data: T, message?: string }
{ success: false, error: string, field?: string }

// Helpers in lib/api-utils.ts
successResponse(data, message?)
errorResponse(error, status)
unauthorizedResponse()
forbiddenResponse()
zodErrorResponse(zodError)
```

- Validate input with **Zod** in API routes.
- Use **`getSessionFromRequest(request)`** from `lib/session.ts` (not the placeholder in api-utils).
- Return relative URLs for uploads in dev (`/uploads/...`); Zod `.url()` rejects these — use plain `z.string()` for document URLs.

### 4.4 Frontend data fetching

```typescript
const { data } = useQuery({
  queryKey: ['unique-key', params],
  queryFn: () => apiGet<Type>('/api/endpoint'),
  enabled: !!condition,
})
```

- Mutations invalidate related query keys on success.
- **`useAuth()`** → `GET /api/auth/me` (cached as `['auth', 'me']`).

---

## 5. Authentication & Sessions

| Item | Detail |
|------|--------|
| Login | `POST /api/auth/login` → sets `mediend_session` cookie |
| Session read | `lib/session.ts` → JWT decode → `{ id, email, role }` |
| Logout | `POST /api/auth/logout` |
| Current user | `GET /api/auth/me` |
| Tester role | `TESTER` can impersonate roles via localStorage (`use-auth.ts`) |

**Important:** After Prisma schema changes, run `npx prisma generate` and **restart dev server**.

---

## 6. Roles & Permissions

### 6.1 Key roles (`UserRole` enum)

| Role | Typical function |
|------|------------------|
| `MD` | Managing Director — full oversight, `/md/*` pages |
| `EXECUTIVE_ASSISTANT` | **Project Head** — cross-domain ops, insurance, HRMS, sales visibility |
| `SALES_HEAD` | Sales department head, sets team targets |
| `TEAM_LEAD` | Manages BD team, pipeline, own team target |
| `BD` | Business Development — owns leads, KYP, IPD mark |
| `INSURANCE_HEAD` / `INSURANCE` | Pre-auth, discharge, cash review |
| `PL_HEAD` / `PL_ENTRY` | P&L records, outstanding |
| `HR_HEAD` | HR admin — employees, payroll, leaves |
| `FINANCE_HEAD` | Ledger, approvals, payroll |
| `COMPLIANCE_HEAD` | Post-surgery compliance calls |
| `DIGITAL_MARKETING_HEAD` | DM dashboard, CPL |
| `IT_HEAD` | IT project P&L |
| `ADMIN` | System admin |
| `USER` | Basic employee self-service |

### 6.2 Permission system

- Defined in **`lib/rbac.ts`** as `Permission` strings (e.g. `leads:write`, `targets:read`, `hrms:employees:write`).
- **`hasPermission(user, permission)`** checks role → permission map.
- Nav items can require `roles: [...]` or `permission: '...'` in `lib/sidebar-nav.ts`.

### 6.3 Hierarchy

```
User (1:1) Employee
  Employee.managerId → Employee (Team Lead)
  Employee.subordinates → Employee[] (BDs)
  Employee.departmentId → Department
  Department.headId → User (Department Head)
  DepartmentTeam — optional sub-teams with teamLeadId
```

---

## 7. Core Business Domains

### 7.1 Lead / Patient Case Flow

**Central doc:** `docs/PATIENT-CASE-FLOW.md`

```
Lead (patient + case)
 ├── KYPSubmission (1:1)
 ├── PreAuthorization (1:1)
 ├── AdmissionRecord (1:1)
 ├── DischargeSheet (1:1)
 ├── PLRecord (1:1)
 ├── InsuranceCase (1:1)
 ├── CaseStageHistory[]
 └── CaseChatMessage[]
```

**Two axes:**
- **`pipelineStage`:** SALES → INSURANCE → PL → COMPLETED / LOST
- **`caseStage`:** granular workflow (KYP_BASIC_PENDING → … → DISCHARGED → PL_PENDING)
- **`flowType`:** INSURANCE or CASH (different stage enums)

**Key pages:**
- `/patient/[leadId]` — case hub
- `/patient/[leadId]/kyp/basic` — KYP form
- `/patient/[leadId]/raise-preauth` — pre-auth raise
- `/patient/[leadId]/discharge` — discharge sheet
- `/bd/kyp` — Case Tracker (date range filter)
- `/bd/pipeline`, `/team-lead/pipeline` — sales pipeline

**Key APIs:**
- `GET/POST /api/leads`, `GET/PATCH /api/leads/[id]`
- `POST /api/kyp/submit`, `POST /api/kyp/upload`
- `POST /api/leads/[id]/ipd-mark` — mark IPD (requires patient name + Aadhaar for ADMITTED_DONE/IPD_DONE)
- `GET /api/case-tracker` — filtered case list for tracker page

### 7.2 Targets & Achievements

**Target types:** `BD`, `TEAM`, `DEPARTMENT_HEAD`  
**Metrics:** `IPD_DONE`, `LEADS_CLOSED`, `NET_PROFIT`, `HEAD_COUNT`, `REVENUE`, etc.

| Page | Role |
|------|------|
| `/sales/targets` | Sales Head (write) |
| `/team-lead/targets` | Team Lead (read) |
| `/executive-assistant/targets` | EA (read-only, reuses sales page) |
| `/home` → EA section | EA only — all TL achievements |

**APIs:**
- `GET /api/targets/teams` — team leads + BD members
- `GET /api/targets/progress?month=YYYY-MM` — achievement calculation
- `POST /api/targets` — create target (Sales Head)

IPD counting uses **`lib/analytics/ipd-filters.ts`** → `canonicalSalesCompletedWhere()`.

### 7.3 HRMS

| Area | Routes |
|------|--------|
| Employees | `/hr/employees`, `/api/employees` |
| Attendance | `/hr/attendance`, biometrics sync via `/api/attendance/sync` |
| Leaves | `/hr/leaves`, `/api/leaves` |
| Payroll | `/hr/payroll`, `/api/finance/payroll` |
| Profile | `/profile`, `/api/profile` |
| My Team | `/employee/my-team`, `/api/hierarchy/my-team/*` |
| Documents | `/hr/documents`, offer letters, increment letters |

**Employee model** links to User; stores bank details, docs, lifecycle status (ACTIVE, ON_PIP, ON_NOTICE, TERMINATED).

### 7.4 Finance

- **Ledger:** `/finance/ledger`, `/api/finance/ledger`
- **Sales entries:** `/finance/sales`
- **Payroll generation:** `/finance/payroll/generate`
- **Company P&L:** `/finance/pnl`, `/md/pnl`
- **Inventory:** `/finance/inventory`

### 7.5 MD Module

- `/md/home` — MD dashboard (MD users redirected from `/home`)
- `/md/tasks` — task management with approvals
- `/md/sales`, `/md/finance`, `/md/hr` — department dashboards
- `/md/approvals`, `/md/md-approvals` — approval workflows
- `/md/compliance` — compliance overview

### 7.6 Home Page

**Doc:** `docs/HOME-PAGE-ARCHITECTURE.md`

- `/home` — role-adaptive dashboard for non-MD users
- Sections: banner, notices, birthdays, KPIs, meets, notifications, nav cards
- **EA-only:** `EaProjectHeadTeamsSection` — team leader achievements
- **TL/Sales Head:** `TeamTargetWidget` — compact target bar

---

## 8. Database — Key Models

| Model | Purpose |
|-------|---------|
| `User` | Login, role, profile (phone, address, gender, etc.) |
| `Employee` | HR record linked to User; hierarchy, bank, docs |
| `Lead` | Patient case — demographics, stage, BD owner |
| `KYPSubmission` | Know Your Patient docs & details |
| `PreAuthorization` | Insurance pre-auth workflow |
| `AdmissionRecord` | IPD details, surgery date, ipdStatus |
| `DischargeSheet` | Post-surgery financial & clinical data |
| `PLRecord` | P&L calculation per case |
| `Target` | Monthly/weekly targets per BD/team/head |
| `Department`, `DepartmentTeam` | Org structure |
| `LeaveRequest`, `AttendanceLog` | HRMS |
| `LedgerEntry`, `SalesEntry` | Finance |
| `Task`, `Meet`, `Notification` | Productivity |
| `TreatmentMaster` | Treatment + ATS for cash auto-approval |

**Schema file:** `prisma/schema.prisma`  
**Migrations:** `prisma/migrations/`  
**Generate client:** `npx prisma generate` → `generated/prisma/`

---

## 9. File Uploads

| Env | Behavior |
|-----|----------|
| Production | AWS S3 via `lib/s3-client.ts` |
| Development (no AWS keys) | Saves to `public/uploads/{folder}/` → served at `/uploads/...` |

**Upload routes:**
- `POST /api/kyp/upload` — KYP docs, IPD Aadhaar (`folder=ipd-mark`)
- `POST /api/profile/upload` — profile photo
- `POST /api/settings/home-banner/upload` — home banner

**Note:** Local upload URLs are relative paths — API validation must accept `z.string()` not `z.string().url()`.

---

## 10. External Integrations

| Integration | Purpose | Key files |
|-------------|---------|-----------|
| **PostgreSQL (Supabase)** | Primary database | `DATABASE_URL` in `.env` |
| **MySQL (legacy CRM)** | Lead sync from old CRM | `scripts/sync-mysql-leads.ts`, `/api/sync/mysql-leads` |
| **AWS S3** | Document storage | `lib/s3-client.ts`, `docs/S3-SETUP.md` |
| **Web Push** | Notifications | `/api/push/subscribe`, service worker |
| **AI providers** | mediendAI chat | `/api/ai/chat`, `components/ai/` |

---

## 11. Environment Variables

```env
DATABASE_URL=              # PostgreSQL (Supabase)
JWT_SECRET=                # Session signing
NEXT_PUBLIC_APP_URL=       # http://localhost:3000 (must match dev port)
AWS_ACCESS_KEY_ID=         # S3 (or placeholder for local uploads)
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AWS_REGION=ap-south-1
# MySQL sync (optional)
MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
```

---

## 12. Coding Conventions (for AI)

1. **Minimize scope** — smallest correct diff; don't refactor unrelated code.
2. **Match existing patterns** — read surrounding files before adding code.
3. **Client pages** — `'use client'`, React Query, shadcn components.
4. **API routes** — session check → permission check → Zod validate → Prisma → response helpers.
5. **Role gates** — check in both API (security) and UI (visibility); UI-only gates are not enough.
6. **Dates** — use `date-fns`; store UTC in DB, display in local timezone.
7. **Prisma** — after schema edits: migrate + generate + restart dev server.
8. **Don't commit** — `.env`, `.next/`, `generated/`, `public/uploads/*`, `node_modules/`.
9. **Git** — only commit when user explicitly asks.
10. **Windows dev** — use `npm run dev` (webpack); port 3000 conflicts need `taskkill /PID /F`.

---

## 13. Common Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| "User not found" on profile | API 500, stale Prisma client | `npx prisma generate` + restart dev |
| Upload fails locally | Placeholder AWS keys | Local fallback in `s3-client.ts` or set real keys |
| "Invalid url" on IPD mark | Relative `/uploads/...` URL | Use `z.string()` not `.url()` in schema |
| CORS errors | Port mismatch (3000 vs 3001) | Set `NEXT_PUBLIC_APP_URL` correctly; kill stale servers |
| Empty EA achievements | No TEAM targets for month | Sales Head sets targets on `/sales/targets` |
| Prisma unknown field | Schema changed, server not restarted | Regenerate + restart |
| API 403 | Missing permission in rbac.ts | Check `lib/rbac.ts` for role permissions |

---

## 14. Key Documentation Index

| Document | Contents |
|----------|----------|
| **`docs/AI-APPLICATION-CONTEXT.md`** | This file — master AI context |
| **`docs/PATIENT-CASE-FLOW.md`** | Full patient/case workflow, stages, APIs |
| **`docs/HOME-PAGE-ARCHITECTURE.md`** | Home page frontend/backend breakdown |
| **`docs/S3-SETUP.md`** | AWS S3 configuration |
| **`docs/CASE-TRACKER-CHAT-CHANGES.md`** | Case tracker feature notes |
| **`docs/SOP-ADD-NEW-EMPLOYEES.md`** | Employee onboarding SOP |
| **`SETUP.md`** | Local dev setup, seed users |
| **`AI_CHATBOT.md`** | AI chat integration |
| **`LEADS_API_DOCS.md`** | Leads API reference |

---

## 15. Quick Route Map (by role)

| Role | Primary entry | Key routes |
|------|---------------|------------|
| MD | `/md/home` | `/md/tasks`, `/md/sales`, `/md/finance`, `/md/hr` |
| Executive Assistant | `/home` | `/executive-assistant/targets`, `/bd/kyp`, `/hr/dashboard`, `/insurance/dashboard` |
| Sales Head | `/home` or `/sales/dashboard` | `/sales/targets`, `/bd/kyp` |
| Team Lead | `/team-lead/dashboard` | `/team-lead/pipeline`, `/team-lead/targets` |
| BD | `/bd/dashboard` | `/bd/pipeline`, `/bd/kyp`, `/patient/[id]` |
| Insurance | `/insurance/dashboard` | `/insurance/cash-cases`, patient discharge |
| HR Head | `/hr/dashboard` | `/hr/employees`, `/hr/payroll` |
| Employee | `/home` | `/profile`, `/employee/dashboard/core-hr` |

---

## 16. How AI Should Use This Document

1. **Start here** for any unfamiliar task in this repo.
2. **Drill into linked docs** (`PATIENT-CASE-FLOW.md`, etc.) for domain depth.
3. **Search before creating** — most patterns already exist (grep similar API routes / components).
4. **Verify role permissions** in `lib/rbac.ts` before adding API endpoints.
5. **Test with seeded users** — see `SETUP.md` for default credentials.
6. **When adding features** — update the relevant section of this doc or create a focused doc in `docs/`.

---

## 17. Recent Feature Notes (conversation context)

These were added/changed recently and may not be in older docs:

- **Case Tracker date range** — `/bd/kyp`, `lib/case-tracker-date-range.ts`, `GET /api/case-tracker`
- **Case Tracker City column** — from `KYPSubmission.location`
- **Mark IPD patient details** — patient name + Aadhaar required for ADMITTED_DONE/IPD_DONE
- **Local dev uploads** — `public/uploads/` when S3 not configured
- **Employee Profile** — `/profile` with personal, employment, addresses, documents, bank (read-only)
- **EA Home achievements** — `EaProjectHeadTeamsSection` on `/home`, EXECUTIVE_ASSISTANT only
