# Case Tracker, Insurance Pages & Chat — Activity Sort, Filters, Empty-Chat Cleanup

Changes made to `/bd/kyp` (Case Tracker), `/insurance/dashboard`, `/insurance/cash-cases`, and `/chat`.

---

## 1. Case Tracker — Sort by True Latest Activity

### Problem
Case tracker sorted by `Lead.updatedDate`, falling back to `createdDate`. `updatedDate` is `@updatedAt` on the Lead row, so it only bumps when a Lead column is written. Many activities mutate **related tables** without touching Lead, so `updatedDate` ≈ `createdDate` for those cases — making the sort effectively "lead date, latest first" rather than "latest activity".

Activities that did **not** bump `Lead.updatedDate`:
- Insurance fills/edits Insurance Initiate Form (`InsuranceInitiateForm`)
- Pre-auth Q&A — insurance asks, BD answers (`InsuranceQuery`)
- Insurance edits policy fields / hospital suggestions (`PreAuthorization`, `HospitalSuggestion`)
- Discharge sheet / PL / outstanding edits after initial creation
- Case chat messages (`CaseChatMessage`)
- Daily MySQL sync only updates Lead if MySQL `patientName`/`status`/`bdId`/`UpdateDate` changed

### Approach
Extend the `view=pipeline` Prisma `select` with related-table activity timestamps; compute `max(...)` on the client to drive the sort.

Considered but rejected: adding a `Lead.lastActivityAt` column bumped from every write site. Cleaner DB sort, but requires touching ~10 write paths and a backfill — not worth it at current scale.

### Files changed

**`app/api/leads/route.ts`** — extended `pipelineSelect`:
- `kypSubmission.updatedAt`
- `kypSubmission.preAuthData.updatedAt`
- `kypSubmission.preAuthData.queries[0].updatedAt` (latest Q&A)
- `insuranceInitiateForm.updatedAt`
- `admissionRecord.ipdStatusUpdatedAt`, `admissionRecord.initiatedAt`
- `dischargeSheet.updatedAt`
- `plRecord.updatedAt`
- `caseStageHistory[0].changedAt` (latest stage transition)
- `caseChatMessages[0].createdAt` (latest chat)

`take: 1` on the array relations keeps join cost minimal.

**`hooks/use-leads.ts`** — extended the `Lead` type with the new optional related fields.

**`lib/lead-activity.ts`** (new) — shared `getLatestActivityTime(lead)` helper that takes the max of:
- `lead.updatedDate`, `lead.createdDate`
- All related timestamps above

**`app/bd/kyp/page.tsx`** — imports the helper. Sort changed from `(b.updatedDate ?? b.createdDate) - (a.updatedDate ?? a.createdDate)` to `getLatestActivityTime(b) - getLatestActivityTime(a)`.

### Insurance pages (same fix)

**`app/api/leads/route.ts`** — `fullInclude` (used by all non-`view=pipeline` callers) extended with the same activity timestamps as `pipelineSelect`. Typed via `satisfies Prisma.LeadInclude` so nested `orderBy` literals stay narrowed.

**`app/insurance/dashboard/page.tsx`** — `LeadWithStage` type extended with the new optional fields. Sort tier-break replaced with `getLatestActivityTime(b) - getLatestActivityTime(a)`. Latest-activity column now displays `getLatestActivityTime(lead)` formatted, instead of `updatedDate ?? createdDate`. (The 14-day / 6-month IPD volume charts at lines 211/226 still key off `updatedDate ?? createdDate` — that's about reaching IPD stage, not activity, so left alone.)

**`app/insurance/cash-cases/page.tsx`** — `LeadWithStage` type extended; sort and latest-activity column updated identically.

### Effect
A lead with recent KYP submission, Q&A, chat, initiate-form edit, or discharge-sheet update floats to the top across all four pages. TL view inherits this automatically — see §3.

---

## 2. Chat List — Only Conversations With Activity

### Problem
`/chat` listed every lead the user could access (up to 100), regardless of whether the case had any chat messages. Empty leads cluttered the list.

Secondary issue: ordering was `Lead.updatedDate desc` then re-sorted client-side by latest message — meaning leads with old `updatedDate` but recent chat could be cut off by the `take: 100` slice.

### Approach
Two-step query:
1. `groupBy` on `CaseChatMessage` by `leadId`, ordered by `_max(createdAt) desc`, take 200 candidate leadIds — surfaces leads in true latest-message order.
2. `lead.findMany` filtered by `id IN candidates` AND existing role/access `where` (`bdId`/`kypSubmission`/`pipelineStage`/`caseStage` per role).
3. Re-sort the fetched leads by the groupBy index, slice to 100.

This guarantees:
- Leads with zero chat messages are excluded entirely.
- Ordering reflects actual message recency, not `Lead.updatedDate`.

### Files changed

**`app/api/chat/conversations/route.ts`** — replaced the single `lead.findMany` ordered by `updatedDate` with the groupBy-then-fetch pattern above.

---

## 3. TL Access — Verified, No Code Change Required

Confirmed both pages already scope TLs to their own + recursive subordinate BDs' leads:

- **Case Tracker** — `app/api/leads/route.ts:43-46` filters `bdId IN (TL.id, ...subordinates)` via `getTeamLeadLeadAccessBdUserIds` (recursive org-chart walk in `lib/hierarchy.ts:180`).
- **Chat List** — `app/api/chat/conversations/route.ts` applies the same TL filter, plus a `canAccessLead` post-filter (`lib/rbac.ts:413-417`) that allows subordinates' leads.
- **Sidebar** — `lib/sidebar-nav.ts:153` includes `TEAM_LEAD` in Case Tracker roles.

The §1 `pipelineSelect` change pulls related-table timestamps for **every** lead the API returns, so a TL's case tracker now reflects activity from any user (BD, insurance, etc.) on their team's cases automatically.

---

## 4. Filters — Month, Stage, BD

Added on both pages. Month is keyed off **lead `createdDate`** (canonical case month). All filtering is client-side on already-loaded data — no extra API calls.

### Case Tracker — `app/bd/kyp/page.tsx`

- **Month** — dropdown of months actually present in the loaded data (sorted desc, formatted `MMM yyyy`).
- **BD** — dropdown of unique BDs in the loaded data, gated on `user.role === 'TEAM_LEAD'`.
- **Stage** — already covered by the existing stage filter cards; no dropdown added.

State: `monthFilter`, `bdFilter` added alongside `stageFilter`. Composition order in `filteredRows`: stage → month → bd → search → sort.

UI: dropdowns sit in the same flex row as the search input (above the leads table).

### Chat List — `components/chat/chat-list.tsx`

- **Search** — free-text input at the top of the filter bar; matches against `patientName`, `leadRef`, `circle`, `bd.name`, and the `latestMessage.content` (case-insensitive).
- **Month** — same shape as case tracker.
- **Stage** — dropdown of stages present in the conversations, labelled via `getCaseStageLabel`.
- **BD** — TL-only.

Filter bar sits at the top of the chat list with a "no conversations match the selected filters" empty state when the active filters exclude everything.

### API extension — `app/api/chat/conversations/route.ts`

Added `createdDate` and `bd: { id, name }` to each conversation in the response so the chat list can filter on them. (Lead's `bd` was already included in the Prisma query; just exposed it in the response shape.)

`components/chat/chat-list.tsx` `Conversation` interface updated to match.

---

---

## 5. Activity Timeline — Show Date and Time

### Problem
On `/patient/[leadId]`, the `ActivityTimeline` component only showed relative time ("3 days ago") next to each stage transition. Hard to compare against external records (e.g. exact time a discharge or pre-auth was raised).

### File changed
**`components/case/activity-timeline.tsx`** — each entry's timestamp row now shows the absolute date+time (`MMM dd, yyyy · h:mm a`) **plus** the relative time in parentheses (`(3 days ago)`). Wrapped in `flex-wrap` so it doesn't break on narrow screens. `format` added to the `date-fns` import.

---

## 6. Pre-Auth Raise — Multi-file Aadhar / PAN Uploads

### Problem
The Pre-Auth Raise form (`/patient/[leadId]/raise-preauth`) only accepted a single Aadhar file and a single PAN file, even though the underlying schema (`KYPSubmission.aadharFiles Json?`, `KYPSubmission.panFiles Json?`) and the BD KYP Basic form already supported multiple uploads. BDs needed to upload front + back (and sometimes more) but were forced to merge them outside the system.

### Files changed

**`components/case/preauth-raise-form.tsx`**
- `kypData` prop type extended to accept `aadharFiles` / `panFiles` arrays.
- Form state replaces the single `aadharFileUrl`/`aadharFileName`/`panFileUrl`/`panFileName` with `aadharFiles: FilePreview[]` and `panFiles: FilePreview[]`. Initial values seed from `kypData.aadharFiles` (multi) when present, falling back to the legacy single `aadharFileUrl` (single → one-element array) so existing cases display correctly.
- Two single `FileUploadRow` blocks replaced with `MultiFileUploadRow` (same component already used for prescriptions / investigation reports / disease images).
- `uploadMultipleFile` / `removeMultipleFile` field unions extended with `'aadharFiles' | 'panFiles'`.
- Validation: requires `aadharFiles.length > 0` and `panFiles.length > 0`.
- Submit body sends both the new `aadharFiles` / `panFiles` arrays AND the legacy `aadharFileUrl` / `panFileUrl` (= first file's URL) for backward compatibility with any reader still on the single-URL fields.
- Review-step summary shows file counts instead of a single filename.

**`app/patient/[leadId]/raise-preauth/page.tsx`** — `KYPSubmission` interface gains `aadharFiles` / `panFiles`; both are forwarded to the form's `kypData` prop so partial uploads survive page revisits.

**`app/api/leads/[id]/raise-preauth/route.ts`** — zod schema accepts `aadharFiles` / `panFiles` arrays; persistence on `KYPSubmission` writes the Json arrays when provided. Legacy single-URL writes preserved for compat.

### No DB migration needed
`KYPSubmission.aadharFiles Json?` and `panFiles Json?` already exist in the schema (added when the BD KYP Basic form went multi-file). The Pre-Auth Raise form now uses them too.

---

---

## 7. Targets Progress — TLs Now See BD Targets They Assign

### Problem
On `/team-lead/targets`, after a TL assigned a BD target (e.g. "Ravi → 10 IPDs"), the page kept showing "No BD activity yet" instead of the leaderboard with `0/10`. The target was being created in the DB but didn't surface for the TL.

### Root cause
`app/api/targets/progress/route.ts` role-based filter for `TEAM_LEAD` returned only:
- BD targets where `targetForId = TL.user.id` (i.e. a target on the TL personally)
- The TEAM target for the TL's team

It never included BD targets assigned to the TL's subordinate BDs — so the targets the TL had just assigned were filtered out before any progress could be computed.

### Fix
**`app/api/targets/progress/route.ts`** — TL branch now also resolves direct subordinate user IDs (BDs only, matching how `/api/targets/teams` defines team membership) and OR-includes `{ targetType: 'BD', targetForId: { in: [TL.id, ...subordinateUserIds] } }` in the where clause. Empty state resolves to the BD leaderboard with each BD's actual/target counts (e.g. `0/10`) as soon as any target exists.

---

---

## 8. Case Tracker — BDM Column Fallback to Assigned BD

### Problem
On `/bd/kyp`, the BDM column read only from `lead.plRecord?.bdmName`. PLRecord is created at discharge, so for the active pipeline (the case tracker's entire scope) there's no `plRecord` yet — the column was permanently `—`. TLs viewing their team's cases noticed it most.

### Fix
**`app/bd/kyp/page.tsx`** — column now falls back to `lead.bd?.name` (the assigned BD, already in `pipelineSelect`) when `plRecord.bdmName` isn't set yet. Once a discharge sheet writes `plRecord.bdmName`, that takes precedence.

---

## File Summary

| File | Change |
|---|---|
| `app/api/leads/route.ts` | Extended `pipelineSelect` and `fullInclude` with related-table activity timestamps; added `satisfies Prisma.LeadInclude` |
| `lib/lead-activity.ts` | (new) Shared `getLatestActivityTime(lead)` helper |
| `hooks/use-leads.ts` | Extended `Lead` type with new optional related fields |
| `app/bd/kyp/page.tsx` | Switched sort to shared helper, added Month + BD (TL) filters |
| `app/insurance/dashboard/page.tsx` | Extended `LeadWithStage`, switched sort tier-break to `getLatestActivityTime`, updated activity column |
| `app/insurance/cash-cases/page.tsx` | Extended `LeadWithStage`, switched sort, updated activity column |
| `app/api/chat/conversations/route.ts` | Two-step `groupBy`-then-fetch query (excludes empty chats, true message-time order); added `createdDate` and `bd` to response |
| `components/chat/chat-list.tsx` | Added Month + Stage + BD (TL) filter dropdowns and `filteredConversations` derivation |
| `components/case/activity-timeline.tsx` | Show absolute date+time (`MMM dd, yyyy · h:mm a`) alongside relative time on each timeline entry |
| `components/case/preauth-raise-form.tsx` | Multi-file Aadhar / PAN uploads; replaced single-file UI with `MultiFileUploadRow`, validation and submit body updated |
| `app/patient/[leadId]/raise-preauth/page.tsx` | Forward `aadharFiles` / `panFiles` from `KYPSubmission` to form's `kypData` |
| `app/api/leads/[id]/raise-preauth/route.ts` | Accept and persist `aadharFiles` / `panFiles` arrays on `KYPSubmission` |
| `app/api/targets/progress/route.ts` | TL filter now includes BD targets assigned to their subordinate BDs (was only returning targets *on* the TL personally) |
| `app/bd/kyp/page.tsx` | BDM column falls back to `lead.bd?.name` for active cases that don't have a `plRecord.bdmName` yet |

## Future Tightening

- **`Lead.lastActivityAt` column** — if the case-tracker grows to tens of thousands of active rows or more pages need this sort, add the column and bump it from each related-table write. Lets the sort move to DB-side `ORDER BY`.
- **Server-side filters for chat** — current month/stage/BD filtering is client-side. If the per-user conversation count routinely exceeds the 100 cap, push these filters into the `groupBy` + `lead.findMany` step.
