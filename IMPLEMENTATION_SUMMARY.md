# Treatment Master with ATS Implementation Summary

## Overview
Implemented a comprehensive treatment master system with Average Ticket Size (ATS) management for cash flow cases, enabling automatic approval for cases meeting or exceeding ATS thresholds.

## Components Implemented

### 1. Database Schema (Prisma)
**File: `prisma/schema.prisma`**

- **TreatmentMaster Model**: Stores treatment names, categories, and ATS amounts for 5 cities (Delhi, Mumbai, Pune, Hyderabad, Bangalore)
- **Lead Model Updates**: Added `treatmentId`, `treatment` (string), `atsAmount`, and `atsStatus` fields
- **ATSStatus Enum**: `PENDING_REVIEW`, `AUTO_APPROVED`, `APPROVED`, `ON_HOLD`

### 2. Seed Data
**File: `prisma/seed-treatments.ts`**

- Parsed ATS.txt and created 60+ treatment records with city-specific ATS values
- Handles price ranges by taking midpoint values
- Example treatments: Rhinoplasty, Bariatric Surgery, ACL Reconstruction, etc.

### 3. API Endpoints

#### a. Treatment Master CRUD
**Files:**
- `app/api/masters/treatments/route.ts` (GET/POST)
- `app/api/masters/treatments/[id]/route.ts` (GET/PATCH/DELETE)

**Features:**
- Full CRUD operations for treatment master data
- ATS lookup by treatment ID and city
- Filtering by category and active status

#### b. Initiate Cash API
**File: `app/api/leads/[id]/initiate-cash/route.ts`**

**Key Features:**
- Accepts `treatmentId`, `treatmentName`, and `atsAmount` from frontend
- ATS Auto-Approval Logic:
  - If `approvedAmount >= atsAmount` → Sets `caseStage` to `CASH_APPROVED` and `atsStatus` to `AUTO_APPROVED`
  - If `approvedAmount < atsAmount` → Sets `caseStage` to `CASH_IPD_SUBMITTED` and `atsStatus` to `PENDING_REVIEW`
- Creates stage history entries with ATS context
- Posts system messages with ATS comparison details
- Notifies insurance team only for manual approval cases

#### c. Cash Review API
**File: `app/api/leads/[id]/cash-review/route.ts`**

**Key Features:**
- Returns ATS context in response (requiresApproval flag)
- Updates `atsStatus` on approval/hold actions
- Creates audit logs with treatment and ATS details

### 4. Frontend Components

#### a. Master Data Page
**File: `app/master-data/page.tsx`**

**Updates:**
- Added "Treatments" tab to the master data interface
- Displays all treatments in a table with columns:
  - Name, Category
  - ATS amounts for all 5 cities
  - Status and Actions
- Form fields for creating/editing treatments with ATS inputs per city

#### b. IPD Cash Form
**File: `components/admission/ipd-cash-form.tsx`**

**Updates:**
- Added treatment dropdown using MasterCombobox
- Displays selected treatment's ATS amount for patient's circle
- Shows real-time ATS comparison:
  - Green badge: "Auto-Approved" when approved amount ≥ ATS
  - Orange badge: "Needs Approval" when approved amount < ATS
- Calculates and displays percentage difference
- Includes `treatmentId` and `atsAmount` in API payload

#### c. Cash Cases Dashboard
**File: `app/insurance/cash-cases/page.tsx`**

**Updates:**
- Added "Treatment" column showing treatment name
- Added "ATS Status" column with visual indicators:
  - Green "Auto-Approved" badge for cases meeting ATS
  - Orange "Needs Approval" badge for cases below ATS
  - Shows approved amount, ATS amount, and percentage difference
- Enhanced review workflow with ATS context

### 5. MasterCombobox Enhancement
**File: `components/ui/master-combobox.tsx`**

**Updates:**
- Extended to support 'treatments' master type
- Added `onItemSelect` callback to return full item data (including ATS)
- Displays treatment category in dropdown
- Returns ATS data for selected treatment

## Key Features

### 1. Automatic Approval
- Cases with approved amount ≥ ATS are automatically approved
- No manual review required for auto-approved cases
- Immediate transition to discharge workflow

### 2. City-Specific ATS
- Each treatment has ATS values for 5 cities
- ATS automatically determined based on patient's circle
- Handles missing ATS values gracefully

### 3. Visual Indicators
- Green badges for auto-approved cases
- Orange badges for cases needing review
- Percentage difference display for quick assessment

### 4. Audit Trail
- All ATS-related decisions logged in audit table
- Stage history includes ATS comparison notes
- System messages document approval decisions

### 5. Admin Interface
- Full CRUD for treatment master data
- ATS management per city
- Easy to update prices as market rates change

## Data Flow

```
1. BD selects treatment in IPD Cash Form
   ↓
2. Frontend fetches ATS for patient's circle
   ↓
3. BD enters approved amount
   ↓
4. Frontend shows real-time ATS comparison
   ↓
5. Form submits with treatment + ATS data
   ↓
6. Backend compares approved vs ATS
   ↓
7. Auto-approve if approved ≥ ATS
   Otherwise: Mark for review
   ↓
8. Insurance reviews cases below ATS
   ↓
9. Approved cases proceed to discharge
```

## Testing Checklist

### Database
- [ ] TreatmentMaster table created with all fields
- [ ] Lead table has new ATS-related columns
- [ ] ATSStatus enum available in generated client

### Seed Data
- [ ] Run `npx tsx prisma/seed-treatments.ts`
- [ ] Verify 60+ treatments created
- [ ] Check ATS values for different cities

### Master Data UI
- [ ] Treatments tab visible in master data page
- [ ] Can create new treatment with ATS values
- [ ] Can edit existing treatment
- [ ] Can deactivate treatment
- [ ] Table shows all ATS columns correctly

### IPD Cash Form
- [ ] Treatment dropdown populated from master
- [ ] ATS amount displays for selected treatment + circle
- [ ] Auto-approval badge appears when approved ≥ ATS
- [ ] Needs approval badge appears when approved < ATS
- [ ] Form submits with treatment and ATS data

### Cash Cases Dashboard
- [ ] Treatment column displays correctly
- [ ] ATS Status column shows badges
- [ ] Green badge for auto-approved cases
- [ ] Orange badge for cases needing review
- [ ] Percentage difference calculated correctly

### Auto-Approval Logic
- [ ] Case auto-approved when approved ≥ ATS
- [ ] Case marked for review when approved < ATS
- [ ] Stage history includes ATS context
- [ ] System messages show ATS comparison
- [ ] Insurance notified only for manual review cases

### Manual Review
- [ ] Insurance can approve cases below ATS
- [ ] Insurance can put cases on hold
- [ ] ATS context visible in review interface
- [ ] Approval transitions work correctly

### Integration
- [ ] End-to-end flow from treatment selection to approval
- [ ] Discharge workflow works for auto-approved cases
- [ ] Audit logs capture all ATS-related actions

## Notes

1. **ATS Calculation**: ATS is determined by matching the patient's circle (city) to the treatment's city-specific ATS field. If circle is "Pune", uses `atsPune`.

2. **Auto-Approval Threshold**: The comparison is strictly `>=`, meaning a case exactly matching ATS is auto-approved.

3. **Missing ATS**: If a treatment has no ATS value for a city, the system treats it as needing manual review.

4. **Treatment Selection**: BD can still use free-text treatment names (fallback), but ATS auto-approval only works with treatment master data.

5. **Currency**: All amounts in INR (₹)

## Future Enhancements

1. **Bulk ATS Import**: CSV upload for updating multiple treatments
2. **ATS History**: Track ATS changes over time
3. **Regional Variations**: Support for more granular location-based ATS
4. **Seasonal Adjustments**: Time-based ATS variations
5. **Insurance Plan Mapping**: Different ATS for insurance vs cash (future)

## Files Modified/Created

### Created
- `prisma/seed-treatments.ts`
- `app/api/masters/treatments/route.ts`
- `app/api/masters/treatments/[id]/route.ts`
- `IMPLEMENTATION_SUMMARY.md` (this file)

### Modified
- `prisma/schema.prisma`
- `components/ui/master-combobox.tsx`
- `app/master-data/page.tsx`
- `components/admission/ipd-cash-form.tsx`
- `app/api/leads/[id]/initiate-cash/route.ts`
- `app/api/leads/[id]/cash-review/route.ts`
- `app/insurance/cash-cases/page.tsx`

## Deployment Steps

1. Run Prisma migration: `npx prisma migrate dev --name add_treatment_master`
2. Run seed script: `npx tsx prisma/seed-treatments.ts`
3. Deploy frontend changes
4. Verify auto-approval logic with test cases
5. Train admin team on treatment master management
6. Document ATS update process for finance team
