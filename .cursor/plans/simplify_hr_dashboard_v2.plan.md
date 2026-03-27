---
name: Simplify HR Dashboard v2
overview: Deduplicate headcount and new-joiner KPIs; MD-only slim month KPIs (drop tickets/avg response); replace pending leaves with on-leave-today; add interviews-done-this-month KPI beside New Joiners; replace late UI with top-5 late today + top-5 punctual (month); remove Team Salary chart and monthly late bar chart.
todos:
  - id: audience-prop
    content: Add HRDashboard audience/variant prop; pass audience=md from app/md/hr/page.tsx only
    status: pending
  - id: headcount-newjoiners
    content: Remove duplicate Headcount KPI; keep New Joiners month KPI (adjacent to Interviews); dedupe table header vs KPI count only
    status: pending
  - id: analytics-on-leave
    content: Extend GET /api/analytics/md/hr with onLeaveTodayCount (+ optional sample rows for table)
    status: pending
  - id: md-month-kpis
    content: audience=md hide Open Tickets + Avg Response; both audiences replace Pending Leaves KPI with On leave today
    status: pending
  - id: late-punctual-tables
    content: Replace Late Today full table + Monthly Late chart with one card—top 5 late today, then top 5 punctual (month)
    status: pending
  - id: remove-team-salary
    content: Remove Team Salary chart block from hr-dashboard.tsx
    status: pending
  - id: interviews-month-kpi
    content: Add interviews done this month KPI next to New Joiners (analytics count + HRDashboard KpiCard)
    status: pending
isProject: false
---

# Simplify HR Dashboard (revised scope)

## Routing

- [app/md/hr/page.tsx](app/md/hr/page.tsx): pass **`audience="md"`** (or `variant`) into `HRDashboard`.
- [app/hr/dashboard/page.tsx](app/hr/dashboard/page.tsx): omit or pass **`audience="hr"`** (default).

Shared implementation remains in [components/hr/hr-dashboard.tsx](components/hr/hr-dashboard.tsx).

## 1. Original “first two” (still in scope)

1. **Remove duplicate Headcount KPI** — Keep **Strength** as `present / total` only; drop the fourth Today tile; Today row → 3 columns (`sm:grid-cols-3`).
2. **New joiners dedupe** — **Keep the New Joiners month KPI** so **Interviews this month** can sit **next to it**; remove duplicate count only from the **New Joiners table** header badge if it repeats the KPI (or hide the table when count is 0).

## 2. MD-only month KPI changes

When `audience === 'md'`:

- **Remove** KPIs: **Open Tickets**, **Avg Response** (average ticket response time).
- **Replace** **Pending Leaves** with **On leave today** (count for calendar today; see API below).

When `audience === 'hr'` (HR_HEAD default):

- Keep **Open Tickets** and **Avg Response** unless product later aligns with MD.
- **Replace** **Pending Leaves** with **On leave today** on this dashboard as well (pending approvals remain on leave workflows elsewhere). *If you prefer HR to still see pending count here, gate: only MD swaps leaves; document in code.*

**Default in this plan:** **On leave today** replaces **Pending Leaves** for **both** audiences; MD additionally drops the two ticket KPIs.

## 2b. Interviews done this month (KPI)

Add a **month** KPI **immediately next to New Joiners** in the KPI row (same grid; order e.g. … → **New Joiners** → **Interviews this month**, or swap if you prefer joiners last—implementation: adjacent columns).

**Definition (recommended):** Count `Meet` rows where `module === 'INTERVIEW'` and `scheduledAt` falls in the **selected dashboard month** (`monthStart`…`monthEnd` UTC, same as analytics month params), and the interview is treated as **done**:

- `scheduledAt <= now()` **or** `isRecorded === true` (covers backfilled “record past interview” rows),

so future-dated slots in the current month are **not** counted until they pass.

**Backend:** Add `interviewsDoneThisMonth: number` (or similar) to the JSON from [app/api/analytics/md/hr/route.ts](app/api/analytics/md/hr/route.ts) via a single `prisma.meet.count({ where: { module: 'INTERVIEW', … } })`.

**Frontend:** Extend `HRAnalytics` / `mergedAnalytics` in [components/hr/hr-dashboard.tsx](components/hr/hr-dashboard.tsx); new `KpiCard` with subtitle e.g. “Conducted / recorded” and optional link to [`/hr/recruitment`](app/hr/recruitment/page.tsx) for HR users with recruitment permission (MD already has access).

**Visibility:** Show for **both** `audience="md"` and `audience="hr"` (recruitment is MD-relevant). If `EXECUTIVE_ASSISTANT` uses this dashboard and should hide it, gate on `hrms:recruitment:read` or role list.

## 3. On leave today (backend)

Extend [app/api/analytics/md/hr/route.ts](app/api/analytics/md/hr/route.ts):

- Count `LeaveRequest` where `status === 'APPROVED'` and **today (UTC, consistent with existing analytics)** overlaps `[startDate, endDate]` (inclusive per existing payroll/attendance patterns).
- Optional: return **`onLeaveToday: { count, employees: { name, code, department }[] }`** capped at 5–10 for a dense tooltip or drill-down row; otherwise dashboard shows count only.

Add fields to `HRAnalytics` type in [components/hr/hr-dashboard.tsx](components/hr/hr-dashboard.tsx) and stop using `pendingLeaveCount` on this page (or keep in API for other consumers).

## 4. Late arrivals → one information-dense card

**Remove:**

- The full **Late Today** scroll table (large card).
- The **Monthly Late Arrivals** horizontal bar chart.

**Add one card** (e.g. “Attendance spotlight”):

1. **Top 5 late today** — From existing `latecomersToday` (already sorted by `minutesLate` desc server-side in analytics; client merged list should match). Show small table: name, dept, punch time, minutes late.
2. **Top 5 punctual (this month)** — From **`monthAttendance`** / merged logic: per employee, over **selected month**, consider only days with an IN punch; employee qualifies if **every** such day is **not** late using the same rule as today: `shiftStart + shiftStartMinute + grace1Minutes` (align with [analytics `isLate`](app/api/analytics/md/hr/route.ts) / [dashboard `getMinutesLate`](components/hr/hr-dashboard.tsx)). Require **minimum working days** (e.g. ≥ 5) to avoid one-off “perfect” records. Sort by number of punctual days descending; take **5**.

Absent today card stays as-is unless you later want it merged.

## 5. Remove Team Salary chart

Delete the **Team Salary** bar chart block from [components/hr/hr-dashboard.tsx](components/hr/hr-dashboard.tsx) (~630–674). Keep **Department Salary** (and **Department Headcount**).

## 6. Data / consistency note

The dashboard currently merges client `/api/employees` + `/api/attendance` with `/api/analytics/md/hr` for Today stats. Prefer **one source of truth** where possible:

- If analytics API already returns `latecomersToday`, `todayStrength`, etc., consider driving Today KPIs + late table from analytics only to avoid drift; optional follow-up, not blocking.

## File touch list

| File | Change |
|------|--------|
| [app/md/hr/page.tsx](app/md/hr/page.tsx) | `audience="md"` |
| [app/hr/dashboard/page.tsx](app/hr/dashboard/page.tsx) | default audience |
| [components/hr/hr-dashboard.tsx](components/hr/hr-dashboard.tsx) | KPI grid, MD gating, late/punctual card, remove charts |
| [app/api/analytics/md/hr/route.ts](app/api/analytics/md/hr/route.ts) | `onLeaveToday*`; `interviewsDoneThisMonth`; optionally drop `pendingLeaveCount` from response if unused |
