# Patient / Case Flow Documentation

This document describes the end-to-end flow of a patient case in the Mediend CRM, covering both **Insurance** and **Cash** paths, all **Pipeline Stages**, **Case Stages**, forms, fields, permissions, and the downstream **P&L** and **Outstanding** modules.

---

## 1. Data Model Overview

There is **no separate Patient table**. The `Lead` model is the central entity — patient identity, demographics, clinical, and commercial data all live on it. Every downstream record hangs off `leadId` (all 1:1 unique):

```
Lead
 ├── KYPSubmission (1:1) ── PreAuthorization (1:1) ── HospitalSuggestion[] ── InsuranceQuery[]
 ├── InsuranceCase (1:1)
 ├── InsuranceInitiateForm (1:1)
 ├── AdmissionRecord (1:1)
 ├── DischargeSheet (1:1) ──optional──> PLRecord
 ├── PLRecord (1:1)
 ├── OutstandingCase (1:1)
 ├── CaseStageHistory[]
 └── CaseChatMessage[]
```

---

## 2. Two Axes: Pipeline Stage vs Case Stage

| Concept | Purpose | Values |
|---------|---------|--------|
| **Pipeline Stage** | High-level business funnel — drives which dashboard the case appears on | `SALES`, `INSURANCE`, `PL`, `COMPLETED`, `LOST` |
| **Case Stage** | Granular workflow state — drives which actions are allowed and permissions | See full enum below |
| **Flow Type** | Determines insurance vs cash path | `INSURANCE`, `CASH` |

---

## 3. Case Stage Enum (Full List)

### Insurance Flow Stages

| Case Stage | Description |
|------------|-------------|
| `NEW_LEAD` | Lead created; no KYP yet |
| `KYP_BASIC_PENDING` | KYP basic form needs to be filled by BD |
| `KYP_BASIC_COMPLETE` | BD has submitted KYP basic; Insurance can suggest hospitals |
| `KYP_DETAILED_PENDING` | Insurance KYP details pending (legacy/alternate) |
| `KYP_DETAILED_COMPLETE` | Insurance KYP details complete (legacy/alternate) |
| `KYP_PENDING` | Legacy alias for KYP in progress |
| `KYP_COMPLETE` | Legacy alias for KYP complete |
| `HOSPITALS_SUGGESTED` | Insurance has suggested hospitals; BD can raise pre-auth |
| `PREAUTH_RAISED` | BD has raised pre-auth; Insurance must approve/reject |
| `PREAUTH_COMPLETE` | Insurance has approved pre-auth; BD can mark admitted |
| `INITIATED` | BD has marked patient admitted (admission details recorded) |
| `ADMITTED` | Patient admitted (used in IPD tracking) |
| `IPD_DONE` | BD has marked surgery done; case is now in Insurance's "Ready for Discharge" queue. BD's part is finished. |
| `DISCHARGED` | Insurance has filled the discharge sheet (auto-set on discharge sheet creation) |
| `PL_PENDING` | Case is in P&L pipeline |
| `OUTSTANDING` | Case has outstanding payments/follow-up |

### Cash Flow Stages

| Case Stage | Description |
|------------|-------------|
| `CASH_IPD_PENDING` | Cash mode started; BD needs to fill IPD cash form |
| `CASH_IPD_SUBMITTED` | BD submitted cash IPD; Insurance must review |
| `CASH_ON_HOLD` | Insurance put cash case on hold (needs BD revision) |
| `CASH_APPROVED` | Insurance approved cash case; discharge can proceed |
| `CASH_DISCHARGED` | Cash discharge completed |

---

## 4. Pipeline Stage Transitions

| Pipeline Stage | When It's Set | Who Cares |
|----------------|---------------|-----------|
| `SALES` | Default when lead is created / synced | BD, Team Lead, Sales |
| `INSURANCE` | When hospital suggestions are submitted (`POST /api/kyp/pre-auth`) | Insurance team |
| `PL` | When discharge sheet is created (auto-creates PLRecord), or manual "Create PNL", or insurance case approved | PL team |
| `COMPLETED` | Manual or business logic (e.g. both payouts PAID on PL edit) | Reporting, MD |
| `LOST` | BD marks lead as lost (`POST /api/leads/:id/mark-lost`) | Reporting |

---

## 5. End-to-End Insurance Flow (Step by Step)

### 5.1 Lead Creation (`SALES`, `NEW_LEAD`)

- Lead is created with `pipelineStage = SALES`, `caseStage = NEW_LEAD`.
- BD / Team Lead owns the lead (`lead.bdId`).

---

### 5.2 Stage 1: KYP Basic — BD Fills Card Details

- **Who:** BD, TEAM_LEAD, ADMIN
- **When:** `caseStage` is `NEW_LEAD` or `KYP_BASIC_PENDING`
- **Page:** `/patient/[leadId]/kyp/basic`
- **Component:** `KYPBasicForm`
- **API:** `POST /api/kyp/submit`
- **Result:** KYP submission created; **case stage → `KYP_BASIC_COMPLETE`**

**Form Fields:**

| Field | Type | Required |
|-------|------|----------|
| patientName | text | Yes |
| phone | text | Only visible if `canViewPhoneNumber` |
| location (City) | combobox with suggestions | Yes |
| area | text | Yes |
| insuranceName | text | No |
| doctorName (Surgeon/Doctor) | text | Yes |
| disease (Treatment) | textarea (read-only, prefilled from lead) | Yes |
| insuranceType | select: `Individual` / `Group-Corporate` | Yes |
| dob | date | Yes |
| age | number | No |
| sex | select: Male / Female / Other | No |
| aadhar | text (validated as Aadhaar format) | No |
| pan | text (validated as PAN format) | No |
| Insurance card files | multi-file upload (pdf/jpg/png) | Yes (≥1) |
| Aadhaar card file | single file upload | No |
| PAN card file | single file upload | No |
| remark (Notes) | textarea | No |

---

### 5.3 Stage 2: Suggest Hospitals — Insurance

- **Who:** INSURANCE, INSURANCE_HEAD, ADMIN, TESTER
- **When:** `caseStage === KYP_BASIC_COMPLETE`
- **Page:** `/patient/[leadId]/pre-auth`
- **Component:** `HospitalSuggestionForm`
- **API:** `POST /api/kyp/pre-auth`
- **Result:** Hospital suggestions saved; **case stage → `HOSPITALS_SUGGESTED`**; **pipeline stage → `INSURANCE`**; BD notified via system chat

**Policy Fields:**

| Field | Type | Required |
|-------|------|----------|
| sumInsured | text | No |
| balanceInsured | text | No |
| copay % | text | No |
| insuranceName | text | No |
| TPA | text | No |
| diseaseCapping | text | No |

**Per Hospital Row:**

| Field | Type | Required |
|-------|------|----------|
| hospitalName | text | Yes |
| suggestedDoctor | text | No |
| tentativeBill (₹) | number | No |
| roomRent — General | number | No |
| roomRent — Single | number | No |
| roomRent — Deluxe | number | No |
| roomRent — Semi-Private | number | No |
| notes | text | No |

**Sub-flow — BD Suggests New Hospital:**
- API: `POST /api/leads/[id]/suggest-hospital` (BD, TEAM_LEAD only)
- Sets `PreAuthorization.bdSuggestedHospital`; notifies Insurance Head
- Insurance can then update the suggestion list (which clears `bdSuggestedHospital` and `preAuthRaisedAt`, forcing BD to re-raise)

---

### 5.4 Stage 3: Raise Pre-Auth — BD

- **Who:** BD, TEAM_LEAD, ADMIN
- **When:** `caseStage === HOSPITALS_SUGGESTED`
- **Page:** `/patient/[leadId]/raise-preauth`
- **Component:** `PreAuthRaiseForm` (multi-step)
- **API:** `POST /api/leads/[id]/raise-preauth`
- **Result:** Pre-auth data saved; **case stage → `PREAUTH_RAISED`**; Insurance notified

**Step 1 — Hospital & Timeline:**

| Field | Type | Required |
|-------|------|----------|
| selectedHospital | card pick from suggested hospitals | Yes |
| roomType | select (from hospital's available room types) | Yes |
| expectedAdmissionDate | date | Yes |
| expectedSurgeryDate | date | Yes |

**Step 2 — Documents & Medical:**

| Field | Type | Required |
|-------|------|----------|
| aadhar (number) | text | No |
| aadharFileUrl | file upload | Yes |
| pan (number) | text | No |
| panFileUrl | file upload | Yes |
| prescriptionFiles | multi-file upload | Yes (≥1) |
| investigationFileUrls | multi-file upload | No |
| diseaseDescription | textarea | Yes |
| diseaseImages | multi-image upload | No |
| notes | textarea | No |

Step 3 is review only (no new fields).

---

### 5.5 Stage 4: Pre-Auth Approval — Insurance

- **Who:** INSURANCE, INSURANCE_HEAD, ADMIN, TESTER
- **When:** `caseStage === PREAUTH_RAISED`
- **Page:** `/patient/[leadId]/pre-auth`
- **Component:** `PreAuthInlineApproval`
- **APIs:**
  - Approve: `POST /api/pre-auth/[kypSubmissionId]/approve`
  - Reject: `POST /api/pre-auth/[kypSubmissionId]/reject`
  - Mark new hospital raised: `POST /api/pre-auth/[kypSubmissionId]/mark-new-hospital-raised`
- **Result:** On approve → **case stage → `PREAUTH_COMPLETE`**; on reject → stays `PREAUTH_RAISED` with `REJECTED` status

**Approve Fields:**

| Field | Type | Required |
|-------|------|----------|
| approvalStatus | `APPROVED` or `TEMP_APPROVED` | Yes |
| approvedAmount | number | Yes |
| approvalNotes | text | No |

**Reject Fields:**

| Field | Type | Required |
|-------|------|----------|
| reason | text | Yes |
| rejectionLetterUrl | file upload | No |

**Notes:**
- **Temp approval** allows partial progress; BD can proceed while insurance finalizes
- **Full `APPROVED`** requires the Insurance Initiate Form to be filled first (totalBillAmount > 0, copay set)
- On approval: `lead.ipdDrName` may be set from the selected hospital's `suggestedDoctor`

#### 5.5a Put Pre-Auth On Hold (internal Insurance status)

Insurance can pause review of a raised pre-auth without making a decision — for example, while waiting on documents from BD or a hospital query. This sets `PreAuthorization.approvalStatus = ON_HOLD` and stores a reason. Case stage stays at `PREAUTH_RAISED`. BD sees the hold + reason as informational on the patient page.

- **Who:** INSURANCE, INSURANCE_HEAD, ADMIN, TESTER (anyone with `insurance:write`)
- **When:** `caseStage === PREAUTH_RAISED` and current `approvalStatus` is `PENDING` (not yet `APPROVED` / `TEMP_APPROVED` / `REJECTED`)
- **API:** `POST /api/pre-auth/[kypSubmissionId]/hold`
- **Body:** `{ reason: string }` (required)
- **Result:** `approvalStatus → ON_HOLD`; `holdReason`, `heldAt`, `heldById` populated; CaseStageHistory entry written; system chat message posted; BD notified.

**Releasing the hold** (any of these):
- Explicit `POST /api/pre-auth/[kypSubmissionId]/release-hold` → returns status to `PENDING`.
- `POST /api/pre-auth/[kypSubmissionId]/approve` (full or temp) → auto-clears the hold.
- `POST /api/pre-auth/[kypSubmissionId]/reject` → auto-clears the hold.
- `POST /api/leads/[id]/reset-patient` → auto-clears the hold (along with the rest of pre-auth state).

The hold is **not** a stage transition — pipeline stage and case stage are unchanged. It is a status flag on `PreAuthorization` so Insurance can manage their own queue, and BD has visibility into why approval is delayed.

---

### 5.6 Stage 5: Insurance Initiate Form — Insurance

- **Who:** INSURANCE, INSURANCE_HEAD, ADMIN, TESTER
- **When:** `caseStage` is `PREAUTH_RAISED` or `PREAUTH_COMPLETE` (and onward)
- **Page:** `/patient/[leadId]/pre-auth?initiate=true`
- **Component:** `InsuranceInitiateForm`
- **APIs:** `POST /api/insurance-initiate-form` (create), `PATCH /api/insurance-initiate-form/[id]` (update)
- **Result:** Initiate form saved; required before full pre-auth approval and before discharge sheet can be filled

**Form Fields:**

| Field | Type | Required |
|-------|------|----------|
| totalBillAmount | number | Yes |
| discount | number | No |
| otherReductions | number | No |
| copay | number | Yes (autofilled from pre-auth copay) |
| copayBuffer | number | No |
| deductible | number | No |
| exceedsPolicyLimit | text | No |
| policyDeductibleAmount | number | No |
| totalAuthorizedAmount | number | No |
| amountToBePaidByInsurance | number | No |
| roomCategory | text (autofilled from requestedRoomType) | No |
| initialApprovalByHospital | file upload (pdf/jpg/png) | No |

---

### 5.7 Stage 6: Mark Admitted / IPD Details — BD

- **Who:** BD, TEAM_LEAD, ADMIN
- **When:** `caseStage === PREAUTH_COMPLETE`
- **Page:** `/patient/[leadId]` (modal)
- **Component:** `IPDDetailsForm`
- **API:** `POST /api/leads/[id]/initiate`
- **Result:** Admission record created; **case stage → `INITIATED`**

**IPD Details Form Fields:**

| Field | Type | Required |
|-------|------|----------|
| admissionDate | date | Yes |
| admissionTime | time | Yes |
| surgeryDate | date | Yes |
| surgeryTime | time | Yes |
| TPA | text (from pre-auth prop) | Yes |
| alternateContactName | text | No |
| alternateContactNumber | text | No |
| quantityGrade | text | No |
| anesthesia | text | No |
| surgeonType | text | No |
| hospitalAddress | text | No |
| googleMapLocation | text | No |
| implantText / implantAmount | text / number | No |
| instrumentText / instrumentAmount | text / number | No |
| consumablesText / consumablesAmount | text / number | No |
| notes | textarea | No |

**Read-only display (from lead/KYP/pre-auth):** Patient name, lead ref, age, gender, circle, treatment, surgeon, hospital, insurance type/company, copay %, sum insured, room type, capping, TPA, BD name, BD manager.

---

### 5.8 Stage 6b: Update IPD Status — BD / TL / EA

- **Who:** BD, TEAM_LEAD, EXECUTIVE_ASSISTANT, ADMIN
- **When:** `caseStage === INITIATED`
- **Page:** `/patient/[leadId]` (modal)
- **Component:** `IPDMarkComponent`
- **API:** `POST /api/leads/[id]/ipd-mark`

**Status options and fields:**

| Status | Fields | Required | Stage transition |
|--------|--------|----------|------------------|
| `ADMITTED_DONE` | notes | No | none |
| `IPD_DONE` | notes | No | `INITIATED → IPD_DONE` — case appears in Insurance's "Ready for Discharge" queue. BD's work is done. |
| `POSTPONED` | reason, newSurgeryDate, notes | reason + newSurgeryDate: Yes | none |
| `CANCELLED` | reason, notes | reason: Yes | none |

> **No `DISCHARGED` option.** BDs do not need to know the discharge date — Insurance captures it on the discharge sheet.

---

### 5.9 Stage 7: Discharge Sheet — Insurance (creates + finalises discharge)

- **Who (create):** INSURANCE, INSURANCE_HEAD, ADMIN, TESTER
- **Who (edit):** INSURANCE, INSURANCE_HEAD, PL_HEAD, PL_ENTRY, ADMIN
- **When:** `caseStage` is `IPD_DONE` (or legacy `DISCHARGED`) **and** `insuranceInitiateForm` exists (blocked otherwise with warning)
- **Page:** `/patient/[leadId]/discharge`
- **Components:** `DischargeSheetForm` (create), `DischargeSheetView` (read-only)
- **APIs:** `POST /api/discharge-sheet` (create), `PATCH /api/discharge-sheet/[id]` (update)
- **Result:**
  - Discharge sheet created with `dischargeDate` captured by Insurance
  - **case stage `IPD_DONE → DISCHARGED`** (auto, on POST)
  - **PLRecord auto-created** (if none exists) with payout statuses set to `PENDING`
  - **pipeline stage → `PL`**
  - PL team notified; compliance call row upserted

**Discharge Sheet Form Fields:**

| Section | Field | Type | Required |
|---------|-------|------|----------|
| **Discharge Info** | dischargeDate | date | Yes |
| | finalAmount (final bill amount ₹) | number | Yes |
| **Documents** | dischargeSummaryUrl | file upload | Yes |
| | otNotesUrl (OT notes) | file upload | No |
| | finalBillUrl | file upload | Yes |
| | settlementLetterUrl | file upload | No |
| **Bill Breakup** | roomRentAmount | number | No |
| | pharmacyAmount | number | No |
| | investigationAmount | number | No |
| | consumablesAmount | number | No |
| | implantsAmount | number | No |
| | instrumentsAmount | number | No |
| | totalFinalBill | computed from above | — |
| **Deductions** | finalApprovedAmount | number | No |
| | cashOrDedPaid (Paid by insured) | number | No |
| | deductionAmount | number | No |
| | discountAmount | number | No |
| | waivedOffAmount | number | No |
| | otherDeduction | number | No |
| | netSettlementAmount | computed | — |
| **Other** | remarks | textarea | No |

**DischargeSheet model also stores** (populated server-side or via PATCH): month, surgeryDate, status, paymentType, approvedOrCash, paymentCollectedAt, managerRole, managerName, bdmName, patientName, patientPhone, doctorName, hospitalName, category, treatment, circle, leadSource, tentativeAmount, copayPct, totalAmount, billAmount, cashPaidByPatient, referralAmount, cabCharges, implantCost, dcCharges, doctorCharges, hospitalSharePct/Amount, mediendSharePct/Amount, mediendNetProfit.

---

## 6. Cash Flow (Alternate Path)

BD can switch a lead to cash mode at early stages. This bypasses the full insurance pre-auth/approval flow.

**Start Cash Mode:** `PATCH /api/leads/[id]` — sets `flowType: CASH`, `caseStage: CASH_IPD_PENDING`
**Revert to Insurance:** Same PATCH — sets `flowType: INSURANCE`, reverts to `KYP_BASIC_COMPLETE` or `NEW_LEAD`

### 6.1 Fill IPD Cash Form — BD

- **Who:** BD, TEAM_LEAD, ADMIN
- **When:** `flowType === CASH` and `caseStage` is `CASH_IPD_PENDING` or `CASH_ON_HOLD`
- **Page:** `/patient/[leadId]` (modal)
- **Component:** `IPDCashForm`
- **Result:** **case stage → `CASH_IPD_SUBMITTED`**

**Form Fields:**

| Section | Field | Type | Required |
|---------|-------|------|----------|
| **Patient** | patientName, age, sex, circle | text/number | No |
| | leadRef | read-only | — |
| | alternateContactName / Number | text | No |
| **Treatment** | category, treatment, quantityGrade, anesthesia | text | No |
| **Surgeon** | surgeonName, surgeonType | text | No |
| **Hospital** | hospitalName, hospitalAddress, googleMapLocation | text | No |
| **Payment** | modeOfPayment | select: Cash / EMI | No (default: Cash) |
| | approvedAmount | number | Yes |
| | finalBillAmount | number | Yes |
| | collectedAmount | number | No |
| | collectedByMediend / collectedByHospital | number | No |
| | discount, copay, deduction | number | No |
| **EMI (if EMI)** | emiAmount | number | Yes (when EMI) |
| | processingFee, gst | number | No |
| | subventionFee | read-only computed | — |
| | finalEmiAmount | number | Yes (when EMI) |
| **Timeline** | admissionDate, admissionTime | date / time | Yes |
| | surgeryDate, surgeryTime | date / time | Yes |
| **Extras** | implant/instrument/consumables text + amount | text / number | No |
| | notes | textarea | No |

### 6.2 Insurance Reviews Cash Case

- **Who:** INSURANCE, INSURANCE_HEAD, ADMIN, TESTER
- **When:** `flowType === CASH` and `caseStage` is `CASH_IPD_SUBMITTED` or `CASH_ON_HOLD`
- **Page:** `/insurance/cash-cases`
- **API:** `POST /api/leads/[id]/cash-review`
- **Fields:** `action: APPROVE | HOLD`, `reason` (required for HOLD)
- **Result:** APPROVE → `CASH_APPROVED`; HOLD → `CASH_ON_HOLD` (BD can re-edit)

### 6.3 Cash Discharge — Insurance

- **Who:** INSURANCE, INSURANCE_HEAD, ADMIN, TESTER
- **When:** `flowType === CASH` and `caseStage === CASH_APPROVED`
- **Page:** `/patient/[leadId]/discharge-cash`
- **Component:** `DischargeCashForm`
- **API:** `POST /api/discharge-sheet-cash`
- **Result:** DischargeSheet + PLRecord created; **case stage → `CASH_DISCHARGED`**; **pipeline stage → `PL`**; BD notified

**Cash Discharge Form Fields:**

| Field | Type | Required |
|-------|------|----------|
| dischargeDate | date | Yes |
| finalAmount | number | Yes |
| remarks | textarea | No |
| finalBillUrl | file upload | No |
| settlementLetterUrl | file upload | No |
| roomRentAmount | number | No |
| pharmacyAmount | number | No |
| investigationAmount | number | No |
| consumablesAmount | number | No |
| implantsAmount | number | No |
| instrumentsAmount | number | No |
| totalFinalBill | computed | — |

---

## 7. P&L Dashboard

### 7.1 How a case enters PL

- **Automatically:** When Insurance creates a Discharge Sheet → PLRecord auto-created, `pipelineStage → PL`, PL team notified
- **Manually:** "Create PNL Record" button on `DischargeSheetView` calls `POST /api/discharge-sheet/[id]/create-pnl` (PL_HEAD, INSURANCE_HEAD, ADMIN) — creates PLRecord if none exists, links to discharge sheet
- **Cash:** `POST /api/discharge-sheet-cash` also creates PLRecord

### 7.2 PLRecord Fields

**Editable on `/pl/record/[leadId]`** (via `PATCH /api/leads/[id]` with `{ plRecord: {...} }`):

| Section | Field | Type |
|---------|-------|------|
| **Identity** | month, surgeryDate, status, paymentType, approvedOrCash, paymentCollectedAt | date/text |
| **People** | managerRole, managerName, bdmName, patientName, patientPhone, doctorName, hospitalName | text |
| **Case** | category, treatment, circle, leadSource | text |
| **Financials** | totalAmount, billAmount, cashPaidByPatient, cashOrDedPaid | number |
| **Cost Lines** | referralAmount, cabCharges, implantCost, dcCharges, doctorCharges | number |
| **Revenue Split** | hospitalSharePct / hospitalShareAmount | number |
| | mediendSharePct / mediendShareAmount | number |
| **Profit** | mediendNetProfit, finalProfit | number |
| **Payout Tracking** | hospitalPayoutStatus | `PENDING` / `PARTIAL` / `PAID` |
| | doctorPayoutStatus | `PENDING` / `PARTIAL` / `PAID` |
| | mediendInvoiceStatus | `PENDING` / `SENT` / `PAID` |
| | hospitalAmountPending, doctorAmountPending | number |
| **Meta** | remarks, closedAt | text / date |

### 7.3 Profit Calculation (on PL edit save)

```
hospAmount = billAmount × hospitalSharePct / 100  (or manual hospitalShareAmount)
medAmount  = billAmount × mediendSharePct / 100   (or manual mediendShareAmount)
costs      = referralAmount + cabCharges + dcCharges + doctorCharges + implantCost
netProfit  = medAmount - costs
mediendNetProfit = manual override OR netProfit
closedAt auto-set when hospitalPayoutStatus + doctorPayoutStatus both = PAID
```

### 7.4 PL Dashboard

- **Page:** `/pl/dashboard`
- **Who:** PL_HEAD, ADMIN
- **Data:** Leads with `pipelineStage` in `[PL, COMPLETED]`, date-filtered
- **KPIs:** Sum of `finalProfit`, average ticket size, pending payout counts
- **Actions:** Click row → `/pl/record/[leadId]` to edit

---

## 8. Outstanding Dashboard

### 8.1 What is "Outstanding"

Post-P&L money still to be collected or paid out for discharged cases: hospital payout, doctor payout, Mediend invoice status, and a "payment received" flag with follow-up remarks.

### 8.2 Outstanding Dashboard

- **Page:** `/outstanding/dashboard`
- **Who:** OUTSTANDING_HEAD, ADMIN
- **Data:** `GET /api/outstanding` — leads with `dischargeSheet` present and `pipelineStage` in `[PL, COMPLETED]`
- **KPIs:** From `plRecord` pending amounts and payout/invoice statuses
- **Actions:** Click → `/outstanding/edit/[leadId]`

### 8.3 Outstanding Edit

- **Page:** `/outstanding/edit/[leadId]`
- **API:** `PATCH /api/outstanding/[leadId]`
- **Prerequisite:** Lead must have a `dischargeSheet`

**Editable Fields:**

| Source | Field | Type |
|--------|-------|------|
| PLRecord | hospitalPayoutStatus | `PENDING` / `PARTIAL` / `PAID` |
| PLRecord | doctorPayoutStatus | `PENDING` / `PARTIAL` / `PAID` |
| PLRecord | mediendInvoiceStatus | `PENDING` / `SENT` / `PAID` |
| PLRecord | hospitalAmountPending | number |
| PLRecord | doctorAmountPending | number |
| OutstandingCase | paymentReceived | boolean (Received / Pending) |
| OutstandingCase | remark2 (follow-up notes) | textarea |

### 8.4 Outstanding Sync

- **API:** `POST /api/outstanding/sync` (PL_HEAD, FINANCE_HEAD, ADMIN)
- Reads PLRecord rows and creates/updates `OutstandingCase` with financial snapshot + computed `outstandingDays` (surgery date → today)
- Does not require discharge sheet — only needs PLRecord

### 8.5 OutstandingCase Model

| Field | Type |
|-------|------|
| srNo | number (Excel serial) |
| month, dos (date of service) | date |
| status, paymentReceived | string / boolean |
| managerName, bdmName, patientName, treatment, hospitalName | text |
| billAmount, settlementAmount, cashPaidByPatient, overallAmount | number |
| implantCost, dciCost | number |
| hospitalSharePct / hospitalShareAmount | number |
| mediendSharePct / mediendShareAmount | number |
| outstandingDays | number (calculated) |
| remarks, remark2 | text |
| handledById | user reference |

---

## 9. Pre-Auth Q&A (Insurance ↔ BD)

- **Page:** `/patient/[leadId]/pre-auth` → Q&A section
- **APIs:** `POST /api/kyp/queries` (raise), answer and resolve routes
- **Model:** `InsuranceQuery` on `PreAuthorization`
- Insurance raises queries; BD answers

---

## 10. Generate PDF

- **Who:** INSURANCE, INSURANCE_HEAD, ADMIN, TESTER
- **When:** `caseStage` is `PREAUTH_RAISED` or `PREAUTH_COMPLETE`
- **Action:** Opens `/api/leads/[id]/preauth-pdf` — no form, button only

---

## 10b. Reset Patient (Insurance — Danger Action)

Insurance can roll a case back to **`HOSPITALS_SUGGESTED`** when a hospital becomes unavailable, the policy changes, or BD raised pre-auth against the wrong hospital. This is the only insurance-driven backward stage transition (other than the implicit revert when modifying hospital suggestions on `/api/kyp/pre-auth`).

- **Who:** INSURANCE, INSURANCE_HEAD, ADMIN
- **When:** `caseStage` is `PREAUTH_RAISED`, `PREAUTH_COMPLETE`, or `INITIATED`. **Blocked once `ADMITTED` or beyond.** Insurance flow only — disabled for cash-flow leads.
- **Page:** `/patient/[leadId]/pre-auth` (header → "Reset Patient" button)
- **Component:** `ResetPatientDialog` (`components/insurance/reset-patient-dialog.tsx`)
- **API:** `POST /api/leads/[id]/reset-patient`
- **Result:** **case stage → `HOSPITALS_SUGGESTED`**; pipeline stage stays `INSURANCE`; activity timeline gets a new entry with the reason; system message posted to case chat; BD + Insurance Head notified.

**Confirmation gate (UI):**

| Field | Type | Required |
|-------|------|----------|
| reason | textarea | Yes |
| confirmation phrase | text — must equal `yes reset this lead` (case-insensitive) | Yes |

Submit stays disabled until both validate.

**Reset effect on data:**

| Entity | Action |
|--------|--------|
| `Lead.caseStage` | → `HOSPITALS_SUGGESTED` |
| `Lead.pipelineStage` | unchanged (`INSURANCE`) |
| `Lead.ipdDrName` | cleared |
| `PreAuthorization` (BD raise inputs) | `requestedHospitalName`, `requestedRoomType`, `expectedAdmissionDate`, `expectedSurgeryDate`, `diseaseDescription`, `diseaseImages`, `investigationFileUrls`, `prescriptionFiles`, `notes` cleared |
| `PreAuthorization` (BD new-hospital sub-flow) | `bdSuggestedHospital`, `isNewHospitalRequest`, `newHospitalPreAuthRaised` cleared |
| `PreAuthorization` (approval state) | `approvalStatus → PENDING`; `approvedAmount`, `approvalNotes`, `approvedAt`, `rejectionReason`, `rejectionLetterUrl`, `rejectedAt`, `preAuthRaisedAt`, `preAuthRaisedById`, `handledAt`, `handledById` all cleared |
| `PreAuthorization.suggestedHospitals` | **kept** (Insurance's hospital list) |
| `PreAuthorization.queries` (Q&A) | **kept** as audit trail |
| `KYPSubmission.aadharFiles` / `panFiles` / `aadharFileUrl` / `panFileUrl` / `insuranceCardFileUrl` | **kept** |
| `KYPSubmission.prescriptionFileUrl` / `diseasePhotos` / `otherFiles` | cleared |
| `InsuranceInitiateForm` | **deleted** (if exists) |
| `AdmissionRecord` | **deleted** (if reset is from `INITIATED`) |
| `CaseStageHistory` | new row with `note` containing reason |
| `CaseChatMessage` | system message posted with reason |
| `Notification` | sent to lead's BD + all `INSURANCE_HEAD` users (excluding actor) |
| `DischargeSheet` / `PLRecord` / `OutstandingCase` | not touched (cannot exist at allowed reset stages) |

**Notes:**
- Files uploaded to object storage are **not** hard-deleted; only the DB references are cleared. This keeps the action reversible at the storage layer if mistakenly invoked.
- The cleared fields are exactly the inputs BD provides during pre-auth raise, so after reset the case is structurally identical to a fresh `HOSPITALS_SUGGESTED` state and BD can re-raise pre-auth normally.

---

## 11. Mark Lost

- **Who:** BD, TEAM_LEAD, ADMIN
- **When:** Not `NEW_LEAD`; not in post-admission stages; stage in allowed list (KYP through pre-auth complete)
- **Page:** `/patient/[leadId]` (dialog)
- **API:** `POST /api/leads/[id]/mark-lost`
- **Fields:** reason (select, required), details (textarea, optional)

---

## 12. Role Permissions Summary

| Function | Roles | Condition |
|----------|-------|-----------|
| **Fill Card Details (KYP)** | BD, TEAM_LEAD, EXECUTIVE_ASSISTANT, ADMIN | `NEW_LEAD` or `KYP_BASIC_PENDING` |
| **Suggest Hospitals** | INSURANCE, INSURANCE_HEAD, ADMIN, TESTER | `KYP_BASIC_COMPLETE` |
| **Modify Hospital Suggestions** | INSURANCE, INSURANCE_HEAD, ADMIN, TESTER | `HOSPITALS_SUGGESTED` or `PREAUTH_RAISED` |
| **Raise Pre-Auth** | BD, TEAM_LEAD, EXECUTIVE_ASSISTANT, ADMIN | `HOSPITALS_SUGGESTED` |
| **Complete Pre-Auth (approve/reject)** | INSURANCE, INSURANCE_HEAD, ADMIN, TESTER | `PREAUTH_RAISED` |
| **Hold / Release Pre-Auth** | INSURANCE, INSURANCE_HEAD, ADMIN, TESTER | `PREAUTH_RAISED` and not yet APPROVED/TEMP_APPROVED/REJECTED |
| **Fill Initiate Form** | INSURANCE, INSURANCE_HEAD, ADMIN, TESTER | `PREAUTH_RAISED` or `PREAUTH_COMPLETE` |
| **View Initiate Form** | INSURANCE, INSURANCE_HEAD, PL_HEAD, PL_ENTRY, OUTSTANDING_HEAD, ADMIN, FINANCE_HEAD, BD, TEAM_LEAD | No stage check |
| **Mark Admitted (Initiate)** | BD, TEAM_LEAD, EXECUTIVE_ASSISTANT, ADMIN | `PREAUTH_COMPLETE` |
| **Update IPD Status (incl. mark IPD_DONE)** | BD, TEAM_LEAD, EXECUTIVE_ASSISTANT, ADMIN | `INITIATED` |
| **Generate PDF** | INSURANCE, INSURANCE_HEAD, ADMIN, TESTER | `PREAUTH_RAISED` or `PREAUTH_COMPLETE` |
| **Create Discharge Sheet** | INSURANCE, INSURANCE_HEAD, ADMIN, TESTER | `IPD_DONE` (or legacy `DISCHARGED`) and initiate form exists |
| **Edit Discharge Sheet** | INSURANCE, INSURANCE_HEAD, PL_HEAD, PL_ENTRY, ADMIN | `IPD_DONE` or `DISCHARGED` and initiate form exists |
| **Reset Patient** | INSURANCE, INSURANCE_HEAD, ADMIN | Insurance flow; `PREAUTH_RAISED`, `PREAUTH_COMPLETE`, or `INITIATED`; requires typed confirmation + reason |
| **Mark Lost** | BD, TEAM_LEAD, EXECUTIVE_ASSISTANT, ADMIN | Not `NEW_LEAD`; not post-admission; stage in allowed list |
| **Start Cash Mode** | BD, TEAM_LEAD, ADMIN | `flowType !== CASH`; stage in early/cash-allowed list |
| **Revert Cash Mode** | BD, TEAM_LEAD, ADMIN | `flowType === CASH` and `CASH_IPD_PENDING` |
| **Fill IPD Cash Form** | BD, TEAM_LEAD, ADMIN | `flowType === CASH` and `CASH_IPD_PENDING` or `CASH_ON_HOLD` |
| **Review Cash Case** | INSURANCE, INSURANCE_HEAD, ADMIN, TESTER | `flowType === CASH` and `CASH_IPD_SUBMITTED` or `CASH_ON_HOLD` |
| **Fill Cash Discharge** | INSURANCE, INSURANCE_HEAD, ADMIN, TESTER | `flowType === CASH` and `CASH_APPROVED` |
| **Edit Outstanding** | OUTSTANDING_HEAD, ADMIN | `lead.dischargeSheet` exists |
| **View Phone Number** | INSURANCE_HEAD, ADMIN | Always |

---

## 13. Stage Transition Summary

### Insurance Flow

| From | To | Trigger (API) | Actor |
|------|----|---------------|-------|
| `NEW_LEAD` | `KYP_BASIC_COMPLETE` | `POST /api/kyp/submit` | BD |
| `KYP_BASIC_COMPLETE` | `HOSPITALS_SUGGESTED` | `POST /api/kyp/pre-auth` (with hospitals) | Insurance |
| `HOSPITALS_SUGGESTED` | `PREAUTH_RAISED` | `POST /api/leads/:id/raise-preauth` | BD |
| `PREAUTH_RAISED` | `PREAUTH_COMPLETE` | `POST /api/pre-auth/:kypSubId/approve` | Insurance |
| `PREAUTH_COMPLETE` | `INITIATED` | `POST /api/leads/:id/initiate` (Mark Admitted) | BD / TL / EA |
| `INITIATED` | `IPD_DONE` | `POST /api/leads/:id/ipd-mark` (status: `IPD_DONE`) — BD's last action | BD / TL / EA |
| `IPD_DONE` | `DISCHARGED` (+ PLRecord auto-created) | `POST /api/discharge-sheet` | Insurance |
| `PREAUTH_RAISED` / `PREAUTH_COMPLETE` / `INITIATED` | `HOSPITALS_SUGGESTED` | `POST /api/leads/:id/reset-patient` (Reset Patient — danger action) | Insurance |

Pipeline: `SALES → INSURANCE` (on hospital suggestion) → `PL` (on discharge sheet creation)

### Cash Flow

| From | To | Trigger | Actor |
|------|----|---------|-------|
| Early stage | `CASH_IPD_PENDING` | `PATCH /api/leads/:id` (start cash mode) | BD |
| `CASH_IPD_PENDING` | `CASH_IPD_SUBMITTED` | IPD Cash Form submit | BD |
| `CASH_IPD_SUBMITTED` | `CASH_APPROVED` | `POST /api/leads/:id/cash-review` (APPROVE) | Insurance |
| `CASH_IPD_SUBMITTED` | `CASH_ON_HOLD` | `POST /api/leads/:id/cash-review` (HOLD) | Insurance |
| `CASH_ON_HOLD` | `CASH_IPD_SUBMITTED` | BD re-edits and resubmits | BD |
| `CASH_APPROVED` | `CASH_DISCHARGED` | `POST /api/discharge-sheet-cash` | Insurance |

---

## 14. 8-Step Stage Progress (UI Component)

The `StageProgress` component (`components/case/stage-progress.tsx`) shows these 8 steps visually on the patient page:

| # | Step | Actor | Color |
|---|------|-------|-------|
| 1 | Insurance Card Details (KYP) | BD | Blue |
| 2 | Suggest Hospitals | Insurance | Purple |
| 3 | Pre-Auth Raise | BD | Blue |
| 4 | Pre-Auth Approval | Insurance | Purple |
| 5 | Insurance Initial Form | Insurance | Purple |
| 6 | IPD Details (Mark Admitted) | BD | Blue |
| 7 | IPD Mark (Status Update) | BD | Blue |
| 8 | Discharge Summary (Insurance fills, captures discharge date) | Insurance | Purple |

Cash flow uses `CashStageProgress` with 4 steps: IPD Cash Form → Insurance Review → Approved → Discharge.

---

## 15. Key Pages Reference

| Page | Route | Purpose |
|------|-------|---------|
| BD Pipeline | `/bd/pipeline` | Lead table with status buckets, stage badges, filters |
| Team Lead Pipeline | `/team-lead/pipeline` | Same component as BD pipeline |
| Patient Hub | `/patient/[leadId]` | Central detail page — all sections, actions, modals |
| KYP Basic | `/patient/[leadId]/kyp/basic` | BD fills card details |
| Pre-Auth Workspace | `/patient/[leadId]/pre-auth` | Insurance: hospitals, approval, initiate form, Q&A |
| Raise Pre-Auth | `/patient/[leadId]/raise-preauth` | BD raises pre-auth (multi-step) |
| Insurance Discharge | `/patient/[leadId]/discharge` | Insurance fills discharge sheet |
| Cash Discharge | `/patient/[leadId]/discharge-cash` | Cash flow discharge |
| Print IPD | `/patient/[leadId]/print/ipd` | Print IPD details |
| Insurance Dashboard | `/insurance/dashboard` | Insurance work queue with tabs |
| Cash Cases | `/insurance/cash-cases` | Cash case review dashboard |
| PL Dashboard | `/pl/dashboard` | P&L overview + KPIs |
| PL Record Edit | `/pl/record/[leadId]` | Edit PL financials and payout statuses |
| Outstanding Dashboard | `/outstanding/dashboard` | Payout tracking and pending amounts |
| Outstanding Edit | `/outstanding/edit/[leadId]` | Edit payout statuses and follow-up |
| Chat | `/chat/[leadId]` | BD ↔ Insurance case chat |

---

## 16. Key API Routes Reference

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/leads` | GET | List leads (filtered by role) |
| `/api/leads/[id]` | GET / PATCH | Single lead + nested data / update lead + plRecord |
| `/api/leads/[id]/stage-history` | GET | Case stage transition timeline |
| `/api/leads/[id]/mark-lost` | POST | Mark lead as lost |
| `/api/leads/[id]/suggest-hospital` | POST | BD suggests new hospital |
| `/api/leads/[id]/raise-preauth` | POST | BD raises pre-auth |
| `/api/leads/[id]/initiate` | POST | BD marks admitted |
| `/api/leads/[id]/ipd-mark` | POST | BD updates IPD status |
| ~~`/api/leads/[id]/discharge`~~ | — | **Removed.** Insurance now sets `DISCHARGED` as a side-effect of creating the discharge sheet. |
| `/api/leads/[id]/reset-patient` | POST | Insurance resets patient back to Hospitals Suggested (danger action) |
| `/api/leads/[id]/cash-review` | POST | Insurance approve/hold cash case |
| `/api/leads/[id]/preauth-pdf` | GET | Generate pre-auth PDF |
| `/api/kyp/submit` | POST | Submit KYP basic form |
| `/api/kyp/pre-auth` | POST | Insurance suggests hospitals / updates policy |
| `/api/kyp/queries` | POST | Insurance raises query |
| `/api/pre-auth/[kypSubId]/approve` | POST | Insurance approves pre-auth |
| `/api/pre-auth/[kypSubId]/reject` | POST | Insurance rejects pre-auth |
| `/api/pre-auth/[kypSubId]/hold` | POST | Insurance puts pre-auth on hold (internal status) |
| `/api/pre-auth/[kypSubId]/release-hold` | POST | Insurance releases an active hold |
| `/api/pre-auth/[kypSubId]/mark-new-hospital-raised` | POST | Mark new hospital pre-auth raised |
| `/api/insurance-initiate-form` | POST / GET | Create / read initiate form |
| `/api/insurance-initiate-form/[id]` | GET / PATCH | Read / update initiate form |
| `/api/insurance/cases` | GET | List insurance cases |
| `/api/insurance/cases/[id]` | PATCH | Update insurance case (→ PL on approve) |
| `/api/discharge-sheet` | GET / POST | List / create insurance discharge sheet |
| `/api/discharge-sheet/[id]` | GET / PATCH | Read / update discharge sheet |
| `/api/discharge-sheet/[id]/create-pnl` | POST | Manual PL creation from discharge |
| `/api/discharge-sheet-cash` | POST | Cash discharge creation |
| `/api/outstanding` | GET | List outstanding cases |
| `/api/outstanding/[leadId]` | PATCH | Update payout statuses |
| `/api/outstanding/sync` | POST | Sync PLRecord → OutstandingCase |

---

## 17. Reference Data

- **37 insurance companies** (Bajaj Allianz, Star Health, HDFC ERGO, ICICI Lombard, Care Health, Niva Bupa, etc.)
- **73 surgeons** (pre-populated list)
- **4 anesthesia types:** General, Spinal, Local, Tropical
- **78 partner hospitals** (Minerva, Apollo, Fortis, MASSH, SRV, Apex, Surya, HHC, SCI, etc.)

See `app/bd-insurance-dropdowns.txt` for full lists.

---

*This document reflects the implementation as of the current codebase state. Source of truth: Prisma schema, API routes, page components, and `lib/case-permissions.ts`.*
