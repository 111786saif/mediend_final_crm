# SOP: Adding New Employees (HR)

This document describes how to onboard new employees in Mediend CRM using **People & Org → Employees**. User accounts and HR records are created together in one flow; there is no separate “Users” table in this area.

---

## Prerequisites

- You have **HR** access with permission to create users (typically `users:write` alongside employee read/write).
- You know the new hire’s **legal name**, **work email**, and a **temporary or initial password** (minimum 6 characters).
- **Employee code** is unique in the system (e.g. `EMP042`).
- **CRM Number** (legacy MySQL BDM field) is optional but required if you want **historical leads** synced to this person; it must be unique if used.

---

## Step 1 — Open Employee Management

1. Sign in to the CRM.
2. In the sidebar, open **HRM** (or equivalent HR section).
3. Go to **People & Org**.
4. Select the **Employees** tab (default).

---

## Step 2 — Start “Add Employee”

1. Click **Add Employee** (top right).
2. The wizard has three steps: **Details** → **Sync** → **Review**.

---

## Step 3 — Enter employee details (Step 1: Details)

For each person you are adding:

| Field | Required | Notes |
|--------|----------|--------|
| Name | Yes | Full name as it should appear in the system |
| Email | Yes | Login email; must be unique |
| Password | Yes | Min 6 characters; share securely with the employee |
| Employee code | Yes | Unique identifier (e.g. biometric / HR code) |
| Role | Yes | Must match what your role is allowed to create |
| CRM Number | No | Use for lead sync; label in UI is “CRM Number” (not “BD number”) |
| Department | No | As applicable |
| Manager | No | Pick from existing employees |
| Join date | No | HR join date |
| Birthday | No | Date of birth |

**Adding more than one employee in one session**

1. Complete the form for the first employee.
2. Click **Add Another Employee**.
3. Use the chips at the top to switch between people and edit each row.

---

## Step 4 — Configure sync (Step 2: Sync)

Sync options apply **per employee** and only make sense when data exists in source systems.

| Option | When it applies | Date range (as implemented) |
|--------|------------------|-----------------------------|
| **Sync Leads** | Only if **CRM Number** is set | From **2025-01-01** |
| **Sync Attendance** | Always available for the employee | From **2026-01-01** |

1. Turn **Sync Leads** on for BD/TL (or anyone) who should receive **historical leads** mapped by CRM Number in MySQL.
2. Turn **Sync Attendance** on if punches should be pulled from the biometric integration for that **employee code**.

**Note:** Sync can take several minutes. You will get a progress modal after creation (see Step 6).

---

## Step 5 — Review and create (Step 3: Review)

1. Check the summary table: names, emails, roles, codes, CRM numbers, and which sync flags are on.
2. Read the reminder that **Finance** is notified to set up payroll.
3. Click **Create** / **Create N Employees** to submit.

**Outcome**

- A **login user** and linked **employee** record are created for each successful row.
- **Finance** users (Finance Head role) receive an in-app notification pointing to **Finance → Payroll** (`/finance/payroll`) to add salary structure.
- If any row fails (duplicate email, duplicate code, duplicate CRM number, etc.), an error is shown for that row; others may still succeed.

---

## Step 6 — Sync progress modal

After a successful batch **with sync enabled**:

1. A **Sync** modal opens showing overall progress and per-employee **Leads** / **Attendance** status.
2. **Do not close the browser tab or refresh** while sync is running, if you want to watch progress uninterrupted.
3. You may **minimize** the modal; sync continues **in the background**. You will get a toast when it completes (if you had minimized).
4. When leads sync finishes for a BD/TL with a valid CRM Number, their **assigned leads** in CRM should reflect synced history (subject to MySQL mapping rules).

---

## Step 7 — Optional documents

If the add form does not yet include file upload in your build, capture identity / HR documents through your existing process (e.g. Compensation & Docs, or URLs on the employee record after creation). *When upload is wired in the UI, attach optional documents in the same wizard step as documented in product release notes.*

---

## Step 8 — View or edit after onboarding

1. On the **Employees** list, rows are **not** opened by clicking the whole row.
2. Click **View** in the **Actions** column to open the side panel.
3. The panel is wide (~60% of the viewport), shows **avatar** (initials), **role**, **status**, **profile completion %**, employment and personal details, **CRM Number** when set, bank block, leave balances, and documents when present.
4. Use **Edit** inside the panel (if you have write access) or the edit dialog as applicable for ongoing HR updates.

---

## Step 9 — Finance — payroll structure

1. Finance opens **Finance** in the sidebar → **Payroll** (canonical URL: `/finance/payroll`).  
   *Note: `/hr/payroll` redirects to Finance payroll.*
2. Locate the new employee and configure **salary structure** per company process.

---

## Troubleshooting (quick reference)

| Issue | What to check |
|--------|----------------|
| Cannot see **Add Employee** | Your role may lack `users:write`; contact Admin. |
| Email / code / CRM number error | Uniqueness conflict; pick a new value. |
| No leads after sync | CRM Number wrong or missing; MySQL connectivity; mapping in sync logs. |
| No attendance after sync | Employee code must match biometric **EmpCode**; date range starts 2026-01-01. |
| Sync modal says “job not found” | Server restart clears in-memory job store; re-run sync from IT/Admin if needed. |

---

## Related paths (for admins)

- Employee list & add: **People & Org → Employees** (`/hr/people` with Employees tab, or direct employees route if used).
- Payroll: **`/finance/payroll`**
- Historic sync scripts (CLI, server-side reference): `scripts/sync-historic-mysql-leads.ts`, `scripts/sync-historic-attendance.ts`

---

*Document version: aligned with unified employee onboarding + sync UX. Update this SOP when product copy or permissions change.*
