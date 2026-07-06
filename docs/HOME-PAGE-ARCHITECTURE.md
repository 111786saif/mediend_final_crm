# Home Page — Code Structure & Data Flow

This document explains how **`/home`** works end-to-end: routing, frontend components, hooks, API routes, auth, permissions, and role-based UI.

Use this as a map when adding new home widgets or debugging data issues.

---

## 1. Route & Entry Point

| Item | Location |
|------|----------|
| URL | `/home` |
| Page file | `app/home/page.tsx` |
| Layout | Wrapped by `components/authenticated-wrapper.tsx` (sidebar + auth guard) |
| MD redirect | MD users are redirected to `/md/home` on mount |

```
Browser → /home
    └── app/home/page.tsx (client component)
            └── AuthenticatedWrapper (layout)
                    ├── useAuth() → GET /api/auth/me
                    └── AppSidebar → lib/sidebar-nav.ts
```

---

## 2. High-Level Architecture

```mermaid
flowchart TB
  subgraph Frontend["Frontend (React)"]
    HP[app/home/page.tsx]
    HP --> Auth[useAuth]
    HP --> Banner[BannerSection]
    HP --> EA[EaProjectHeadTeamsSection]
    HP --> TLW[TeamTargetWidget]
    HP --> KPI[KPISection]
    HP --> Meets[TodaysMeetsSection]
    HP --> Nav[NavCards]
  end

  subgraph Hooks["Shared hooks"]
    Auth --> API1[/api/auth/me]
    KPI --> API2[/api/badge-counts]
    EA --> API3[/api/targets/teams]
    EA --> API4[/api/targets/progress]
    TLW --> API4
    Meets --> API5[/api/meets?today=true]
    Banner --> API6[/api/settings/user-banner]
  end

  subgraph Backend["Backend (Next.js API)"]
    API1 --> Session[getSessionFromRequest]
    API3 --> RBAC[hasPermission targets:read]
    API4 --> RBAC
    API4 --> Prisma[(PostgreSQL via Prisma)]
    API3 --> Prisma
    API2 --> Prisma
  end
```

---

## 3. Frontend File Structure

```
app/
  home/
    page.tsx                          ← Main home page (all sections composed here)

components/
  home/
    ea-project-head-teams-section.tsx ← EA / Project Head team achievements (EA only)
  targets/
    team-target-widget.tsx            ← Compact team target widget (TL + Sales Head)
  notices/                            ← Notice modals & sheets used on home
  birthday-*.tsx                      ← Birthday popup / celebration cards
  hr/fnf-reminder-card.tsx            ← HR FnF reminder (HR_HEAD only)
  ui/stat-card.tsx                    ← KPI stat tiles

hooks/
  use-auth.ts                         ← Current user session
  use-badge-counts.ts               ← KPI badge numbers
  use-notifications.ts              ← Recent notifications list
  use-settings.ts                     ← User banner get/update
  use-file-upload.ts                  ← Banner image upload
  use-work-logs.ts                    ← Work log enforcement check
  use-push-subscription.ts            ← Push notification opt-in banner

lib/
  api-client.ts                       ← apiGet / apiPost / apiPatch (fetch wrapper)
  session.ts                          ← JWT cookie read/write (server)
  rbac.ts                             ← Role → permission mapping
  sidebar-nav.ts                      ← Role-filtered navigation items
  analytics/ipd-filters.ts            ← Canonical IPD-done filter (used in target progress)

app/executive-assistant/
  targets/page.tsx                    ← Full read-only targets view (reuses sales page)
```

---

## 4. Page Sections (Top → Bottom)

| # | Section | Component | Who sees it | Data source |
|---|---------|-----------|-------------|-------------|
| 1 | Birthday popup | `BirthdayPopup` | All | `/api/employees/birthdays` (via popup component) |
| 2 | Notice blocker | `NoticeBlockerModal` | All (if pending) | Notices API |
| 3 | Banner + greeting | `BannerSection` | All | `/api/settings/user-banner` |
| 4 | Thought of the day | `ThoughtOfTheDay` | All | Static `data/thoughts-of-the-day.ts` |
| 5 | Birthday celebration | `BirthdayCelebrationCard` | All | Internal queries |
| 6 | Add work log | `AddWorkLogButton` | MD team / watchlist users | `/api/work-logs/check` |
| 7 | Push reminder | `PushReminderBanner` | Users without push permission | Browser API |
| 8 | FnF reminder | `FnFReminderCard` | `HR_HEAD` only | HR APIs |
| 9 | Notices actions | `NoticeActions` | Permission-based | `/api/permissions/check` |
| 10 | Team target widget | `TeamTargetWidget` | `TEAM_LEAD`, `SALES_HEAD` | `/api/targets/progress` |
| 11 | **Team Leader achievements** | `EaProjectHeadTeamsSection` | **`EXECUTIVE_ASSISTANT` only** | `/api/targets/teams` + `/api/targets/progress` |
| 12 | At a Glance (KPIs) | `KPISection` | All (content varies by role) | `/api/badge-counts` |
| 13 | Today's meets | `TodaysMeetsSection` | All | `/api/meets?today=true` |
| 14 | Recent notifications | `RecentNotifications` | All (hidden if empty) | `/api/notifications` |
| 15 | Quick navigation | `NavCards` | All | `lib/sidebar-nav.ts` + badge counts |

---

## 5. Role-Based Visibility

### Executive Assistant (Project Head)

The **Team Leader Achievements** block is the main EA-specific home feature.

```tsx
// components/home/ea-project-head-teams-section.tsx
if (user?.role !== 'EXECUTIVE_ASSISTANT') return null
```

- Renders **nothing** for BD, Team Lead, Sales Head, MD, etc.
- Shows every Team Lead with:
  - Monthly team IPD target progress
  - Status badge (Completed / On Track / At Risk)
  - Full team member breakdown (IPD counts per BD)
- Links to **`/executive-assistant/targets`** for the full read-only targets page

### Team Lead & Sales Head

```tsx
// components/targets/team-target-widget.tsx
enabled: user.role === 'TEAM_LEAD' || user.role === 'SALES_HEAD'
```

Shows a compact single-team target bar with top 3 BDs.

### MD

```tsx
// app/home/page.tsx
useEffect(() => {
  if (user?.role === 'MD') router.replace('/md/home')
}, [user, router])
```

MD never stays on `/home`; they use `/md/home` instead.

### HR Head

`showFnFCard = user?.role === 'HR_HEAD'` → shows FnF reminder card.

---

## 6. Executive Assistant Section — Detailed Flow

### 6.1 Frontend

**File:** `components/home/ea-project-head-teams-section.tsx`

```
EaProjectHeadTeamsSection
├── useAuth()                         → role check
├── useQuery(['target-teams'])        → GET /api/targets/teams
├── useQuery(['target-progress'])     → GET /api/targets/progress?month=YYYY-MM&targetType=TEAM
├── useMemo → merge teams + targets by team lead employee id
├── Summary stats (teams tracked, target, actual, %)
└── TeamLeaderCard[] (one per team lead)
        ├── TL avatar, name, status badge
        ├── Progress bar (actual / targetValue)
        └── Member list (bdBreakdown from progress API)
```

**Merge logic:**

```ts
const targetByTeamId = new Map(targets.map(t => [t.targetForId, t]))
teams.map(team => ({
  team,
  target: targetByTeamId.get(team.id) ?? null,  // team.id = Employee.id of TL
}))
```

### 6.2 Backend APIs

#### `GET /api/targets/teams`

**File:** `app/api/targets/teams/route.ts`

| Step | What happens |
|------|----------------|
| Auth | `getSessionFromRequest(request)` |
| Permission | `hasPermission(user, 'targets:read')` |
| Query | All `Employee` where `user.role = TEAM_LEAD` |
| Include | BD subordinates (`subordinates` where role = BD) |
| Response | Array of `{ id, name, members[], memberCount, ... }` |

`id` here is **`Employee.id`** — used as `targetForId` when creating TEAM targets.

#### `GET /api/targets/progress`

**File:** `app/api/targets/progress/route.ts`

| Query param | Required | Description |
|-------------|----------|-------------|
| `month` | Yes | `YYYY-MM` |
| `teamId` | No | Filter to one team lead's employee id |
| `targetType` | No | `BD` or `TEAM` |

**For EXECUTIVE_ASSISTANT:** no extra role filter → returns **all** targets for the month.

**Progress calculation (IPD_DONE):**

1. Load `Target` rows overlapping the month
2. For `TEAM` targets → resolve team lead + BD subordinates
3. Count completed leads per BD using `canonicalSalesCompletedWhere()` from `lib/analytics/ipd-filters.ts`
4. Sum for team `actual`; build `bdBreakdown[]` per member
5. Compute `percentage` and `status`:
   - `>= 100%` → `completed`
   - `>= 60%` → `on_track`
   - else → `at_risk`

**Response shape (per target):**

```json
{
  "id": "target_...",
  "targetType": "TEAM",
  "targetForId": "employee_tl_id",
  "entityName": "Amit's Team",
  "targetValue": 25,
  "actual": 12,
  "percentage": 48,
  "status": "at_risk",
  "bdBreakdown": [
    { "id": "user_bd_id", "name": "BD Name", "actual": 5, "percentage": 20 }
  ]
}
```

### 6.3 Related full-page view

```
/executive-assistant/targets
    └── app/executive-assistant/targets/page.tsx
            └── <SalesTargetsPage readOnly />
                    └── app/sales/targets/page.tsx
```

Same APIs, but with month picker and grid of all team cards. Sales Head uses the same page with `readOnly={false}` to set targets via `POST /api/targets`.

---

## 7. Auth & API Client

### Session (backend)

```
Cookie: mediend_session (JWT)
    └── lib/session.ts → getSessionFromRequest()
            └── { id, email, role }
```

Every API route checks session first; returns `401` if missing.

### API client (frontend)

```
lib/api-client.ts
    apiGet('/api/...')
        └── fetch(NEXT_PUBLIC_APP_URL + endpoint, { credentials: 'include' })
        └── expects { success: true, data: T }
```

React Query caches by `queryKey`. Example:

```ts
useQuery({
  queryKey: ['target-progress', 'ea-home', month],
  queryFn: () => apiGet(`/api/targets/progress?month=${month}&targetType=TEAM`),
  enabled: user?.role === 'EXECUTIVE_ASSISTANT',
})
```

---

## 8. Permissions (RBAC)

**File:** `lib/rbac.ts`

| Role | Relevant permissions on home |
|------|------------------------------|
| `EXECUTIVE_ASSISTANT` | `targets:read`, `analytics:read`, broad cross-module read |
| `TEAM_LEAD` | `targets:read` (own team only in progress API) |
| `SALES_HEAD` | `targets:read`, `targets:write` |
| `BD` | `targets:read` (own BD target only) |

Target APIs gate on:

```ts
if (!hasPermission(user, 'targets:read')) return errorResponse('Forbidden', 403)
```

---

## 9. Database Models Involved

```
User
  └── Employee (1:1)
        ├── managerId → Employee (team hierarchy)
        ├── subordinates → Employee[] (BDs under TL)
        └── departmentId → Department

Target
  ├── targetType: BD | TEAM
  ├── targetForId: User.id (BD) or Employee.id (TEAM)
  ├── metric: IPD_DONE | LEADS_CLOSED | NET_PROFIT | ...
  ├── targetValue, periodStartDate, periodEndDate
  └── bonusRules[]

Lead
  ├── bdId → User (BD who owns the lead)
  ├── caseStage, pipelineStage
  ├── surgeryDate, conversionDate
  └── used by calculateActual() for achievement counts
```

---

## 10. Other Home API Endpoints

| Endpoint | Hook / component | Purpose |
|----------|------------------|---------|
| `GET /api/auth/me` | `useAuth` | Current user |
| `GET /api/badge-counts` | `useBadgeCounts` | KPI numbers (tasks, approvals, etc.) |
| `GET /api/notifications?unreadOnly=true` | `useNotifications` | Recent unread notifications |
| `GET /api/meets?today=true` | `TodaysMeetsSection` | Today's meetings |
| `GET /api/settings/user-banner` | `useUserBanner` | Home banner image URL |
| `PATCH /api/settings/user-banner` | `useUpdateUserBanner` | Save banner after upload |
| `POST /api/settings/home-banner/upload` | `useFileUpload` | Upload banner image |
| `GET /api/work-logs/check` | `useWorkLogCheck` | Show work log button |
| `GET /api/permissions/check?feature=create_notice` | `NoticeActions` | Can user create notices |
| `GET /api/md/head-targets/achievement` | `MyTargetWidget` | Department head personal target |

---

## 11. Adding a New Home Section — Checklist

1. **Create component** under `components/home/your-section.tsx`
2. **Role gate** inside the component (`if (user?.role !== '...') return null`)
3. **Fetch data** with `useQuery` + `apiGet`, set `enabled` based on role
4. **Add API route** under `app/api/.../route.ts` if new data is needed
   - Use `getSessionFromRequest` + `hasPermission` / role checks
   - Return `successResponse(data)` from `lib/api-utils.ts`
5. **Import & render** in `app/home/page.tsx` in the desired order
6. **Document** endpoint and visibility in this file

---

## 12. Local Development Notes

- Run `npm run dev` on port **3000** (matches `NEXT_PUBLIC_APP_URL`)
- After Prisma schema changes: `npx prisma generate` then restart dev server
- EA home section needs:
  - At least one user with role `EXECUTIVE_ASSISTANT`
  - Team leads (`TEAM_LEAD`) with BD subordinates in `Employee.managerId` hierarchy
  - TEAM targets set for the current month (via Sales Head on `/sales/targets`)

---

## 13. Quick Debug Guide

| Symptom | Likely cause | Check |
|---------|--------------|-------|
| EA section not visible | Wrong role | `GET /api/auth/me` → `role` must be `EXECUTIVE_ASSISTANT` |
| Empty team list | No TL employees | `GET /api/targets/teams` |
| "No target" on all cards | Targets not set for month | Sales Head → Set targets, or check `Target` table |
| API 403 | Missing permission | `lib/rbac.ts` → role has `targets:read` |
| API 500 after schema change | Stale Prisma client | `npx prisma generate` + restart dev server |
| Page shows wrong port / CORS | API base URL mismatch | `.env` → `NEXT_PUBLIC_APP_URL=http://localhost:3000` |
