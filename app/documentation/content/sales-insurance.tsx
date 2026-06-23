// @ts-nocheck
'use client'

import { SubSection, APITable, Card, Callout, PipelineCard } from '../components/docs-components'

export const salesInsuranceSections = {
  'patient-flow': {
    title: 'Patient Case Flow',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>The Patient Case Flow is the core workflow of Mediend CRM. It tracks every lead from creation through insurance processing, discharge, P&L, and outstanding. There are two parallel paths: <strong>Insurance Flow</strong> and <strong>Cash Flow</strong>.</p>

        <SubSection title='Data Model Overview'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>There is <strong>no separate Patient table</strong>. The <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>Lead</code> model is the central entity — patient identity, demographics, clinical, and commercial data all live on it. Every downstream record hangs off <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>leadId</code> (all 1:1 unique):</p>
          <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4'>
            <pre className='text-xs font-mono text-gray-800 dark:text-gray-200'>
{`Lead
 ├── KYPSubmission (1:1) ── PreAuthorization (1:1) ── HospitalSuggestion[] ── InsuranceQuery[]
 ├── InsuranceCase (1:1)
 ├── InsuranceInitiateForm (1:1)
 ├── AdmissionRecord (1:1)
 ├── DischargeSheet (1:1) ──optional──> PLRecord
 ├── PLRecord (1:1)
 ├── OutstandingCase (1:1)
 ├── CaseStageHistory[]
 ├── PaymentInstallment[]
 └── CaseChatMessage[]`}
            </pre>
          </div>
        </SubSection>

        <SubSection title='Two Axes: Pipeline Stage vs Case Stage'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Concept</th><th className='px-4 py-3 text-left font-medium'>Purpose</th><th className='px-4 py-3 text-left font-medium'>Values</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                <tr><td className='px-4 py-3 font-medium'>Pipeline Stage</td><td className='px-4 py-3'>High-level business funnel — drives which dashboard the case appears on</td><td className='px-4 py-3 font-mono text-xs'>SALES, INSURANCE, PL, COMPLETED, LOST</td></tr>
                <tr><td className='px-4 py-3 font-medium'>Case Stage</td><td className='px-4 py-3'>Granular workflow state — drives which actions are allowed and permissions</td><td className='px-4 py-3 font-mono text-xs'>NEW_LEAD through CASH_DISCHARGED (19 stages)</td></tr>
                <tr><td className='px-4 py-3 font-medium'>Flow Type</td><td className='px-4 py-3'>Determines insurance vs cash path</td><td className='px-4 py-3 font-mono text-xs'>INSURANCE, CASH</td></tr>
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Insurance Flow: End-to-End Process'>
          <div className='space-y-4'>
            <PipelineCard stage='1. Lead Creation' actor='BD / System' description='Lead created with pipelineStage=SALES, caseStage=NEW_LEAD. BD or Team Lead owns the lead via lead.bdId.' />
            <PipelineCard stage='2. KYP Basic Form' actor='BD' description='BD fills card details (patient name, insurance, doctor, disease, documents). API: POST /api/kyp/submit. Result: caseStage → KYP_BASIC_COMPLETE.' />
            <PipelineCard stage='3. Suggest Hospitals' actor='Insurance' description='Insurance adds policy fields and suggests hospitals. API: POST /api/kyp/pre-auth. Result: caseStage → HOSPITALS_SUGGESTED, pipelineStage → INSURANCE.' />
            <PipelineCard stage='4. Raise Pre-Auth' actor='BD' description='BD selects hospital, room type, uploads documents. API: POST /api/leads/:id/raise-preauth. Result: caseStage → PREAUTH_RAISED.' />
            <PipelineCard stage='5. Pre-Auth Approval' actor='Insurance' description='Insurance approves or rejects. Can also put on hold. API: POST /api/pre-auth/:kypSubId/approve. Result: caseStage → PREAUTH_COMPLETE.' />
            <PipelineCard stage='6. Insurance Initiate Form' actor='Insurance' description='Insurance fills financial details (bill amount, copay, deductions). Required before discharge. API: POST /api/insurance-initiate-form.' />
            <PipelineCard stage='7. Mark Admitted (IPD)' actor='BD' description='BD records admission date, surgery date, TPA, hospital details. API: POST /api/leads/:id/initiate. Result: caseStage → INITIATED.' />
            <PipelineCard stage='8. IPD Status Update' actor='BD' description='BD marks IPD_DONE when surgery is complete. Case moves to Insurance queue. API: POST /api/leads/:id/ipd-mark.' />
            <PipelineCard stage='9. Mark Discharged' actor='Insurance' description='Step 1: Insurance marks discharged with date only. API: POST /api/leads/:id/mark-discharged. Result: caseStage → DISCHARGED (no PL yet).' />
            <PipelineCard stage='10. Fill Discharge Sheet' actor='Insurance' description='Step 2: Insurance fills bill breakup, deductions, uploads documents. Finalizes the sheet. Result: PLRecord auto-created, pipelineStage → PL.' />
          </div>
          <Callout type='warning' title='Two-Step Discharge'>Step 1 (Mark Discharged) sets the date only — no PL side effects. Step 2 (Fill Sheet) finalizes the discharge, auto-creates PLRecord, and moves the case to the PL pipeline. BD sees "DISCHARGED" after step 1 but the pipeline stays at INSURANCE until step 2.</Callout>
        </SubSection>

        <SubSection title='Cash Flow: End-to-End Process'>
          <div className='space-y-4'>
            <PipelineCard stage='1. Start Cash Mode' actor='BD' description='BD switches lead to cash mode. API: PATCH /api/leads/:id with flowType=CASH. Result: caseStage → CASH_IPD_PENDING.' />
            <PipelineCard stage='2. Fill IPD Cash Form' actor='BD' description='BD fills patient, treatment, surgeon, hospital, and payment details. API: IPD Cash Form submit. Result: caseStage → CASH_IPD_SUBMITTED.' />
            <PipelineCard stage='3. Insurance Review' actor='Insurance' description='Insurance approves or puts on hold. API: POST /api/leads/:id/cash-review. Result: APPROVED → CASH_APPROVED, HOLD → CASH_ON_HOLD.' />
            <PipelineCard stage='4. Re-edit (if on hold)' actor='BD' description='If held, BD re-edits and resubmits. Case returns to CASH_IPD_SUBMITTED.' />
            <PipelineCard stage='5. Cash Discharge' actor='Insurance' description='Insurance fills discharge details. API: POST /api/discharge-sheet-cash. Result: caseStage → CASH_DISCHARGED, pipelineStage → PL, PLRecord auto-created.' />
          </div>
        </SubSection>

        <SubSection title='Case Stage Enum (Full List)'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Stage</th><th className='px-4 py-3 text-left font-medium'>Description</th><th className='px-4 py-3 text-left font-medium'>Flow</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['NEW_LEAD', 'Lead created; no KYP yet', 'Insurance'],
                  ['KYP_BASIC_PENDING', 'KYP basic form needs to be filled by BD', 'Insurance'],
                  ['KYP_BASIC_COMPLETE', 'BD has submitted KYP basic; Insurance can suggest hospitals', 'Insurance'],
                  ['KYP_DETAILED_PENDING', 'Insurance KYP details pending (legacy)', 'Insurance'],
                  ['KYP_DETAILED_COMPLETE', 'Insurance KYP details complete (legacy)', 'Insurance'],
                  ['HOSPITALS_SUGGESTED', 'Insurance has suggested hospitals; BD can raise pre-auth', 'Insurance'],
                  ['PREAUTH_RAISED', 'BD has raised pre-auth; Insurance must approve/reject', 'Insurance'],
                  ['PREAUTH_COMPLETE', 'Insurance has approved pre-auth; BD can mark admitted', 'Insurance'],
                  ['INITIATED', 'BD has marked patient admitted', 'Insurance'],
                  ['ADMITTED', 'Patient admitted (used in IPD tracking)', 'Insurance'],
                  ['IPD_DONE', 'BD has marked surgery done; case in Insurance queue', 'Insurance'],
                  ['DISCHARGED', 'Insurance has marked discharged', 'Insurance'],
                  ['PL_PENDING', 'Case is in P&L pipeline', 'Insurance'],
                  ['OUTSTANDING', 'Case has outstanding payments/follow-up', 'Insurance'],
                  ['CASH_IPD_PENDING', 'Cash mode started; BD needs to fill IPD cash form', 'Cash'],
                  ['CASH_IPD_SUBMITTED', 'BD submitted cash IPD; Insurance must review', 'Cash'],
                  ['CASH_ON_HOLD', 'Insurance put cash case on hold', 'Cash'],
                  ['CASH_APPROVED', 'Insurance approved cash case', 'Cash'],
                  ['CASH_DISCHARGED', 'Cash discharge completed', 'Cash'],
                ].map(([s, d, f], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200'>{s}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{d}</td>
                    <td className='px-4 py-3'><span className={'inline-block px-2 py-0.5 rounded text-xs font-semibold ' + (f === 'Insurance' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700')}>{f}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Pipeline Stage Transitions'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Pipeline</th><th className='px-4 py-3 text-left font-medium'>When Set</th><th className='px-4 py-3 text-left font-medium'>Who Cares</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                <tr><td className='px-4 py-3 font-mono text-xs'>SALES</td><td className='px-4 py-3'>Default when lead is created/synced</td><td className='px-4 py-3'>BD, Team Lead, Sales</td></tr>
                <tr><td className='px-4 py-3 font-mono text-xs'>INSURANCE</td><td className='px-4 py-3'>When hospital suggestions submitted (POST /api/kyp/pre-auth)</td><td className='px-4 py-3'>Insurance team</td></tr>
                <tr><td className='px-4 py-3 font-mono text-xs'>PL</td><td className='px-4 py-3'>When discharge sheet finalized (auto-creates PLRecord) or manual "Create PNL"</td><td className='px-4 py-3'>PL team</td></tr>
                <tr><td className='px-4 py-3 font-mono text-xs'>COMPLETED</td><td className='px-4 py-3'>Manual or when both payout statuses = PAID on PL edit</td><td className='px-4 py-3'>Reporting, MD</td></tr>
                <tr><td className='px-4 py-3 font-mono text-xs'>LOST</td><td className='px-4 py-3'>BD marks lead as lost (POST /api/leads/:id/mark-lost)</td><td className='px-4 py-3'>Reporting</td></tr>
              </tbody>
            </table>
          </div>
        </SubSection>
      </>
    )
  },

  'sales-module': {
    title: 'Sales Pipeline',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>The Sales Pipeline is the primary interface for BD and Team Lead users. It manages leads from initial contact through treatment and insurance processing.</p>

        <SubSection title='Pipeline Views'>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='BD Pipeline' description='/bd/pipeline'>
              <p className='text-xs mt-2 text-gray-500'>Kanban-style board with buckets: All, New/Hot, Follow Up, IPD Done, DNP, Junk, Lost, Closed. BD sees only assigned leads.</p>
            </Card>
            <Card title='Team Lead Pipeline' description='/team-lead/pipeline'>
              <p className='text-xs mt-2 text-gray-500'>Same component as BD pipeline but shows leads for the entire team. Team Lead can assign leads to BDs.</p>
            </Card>
            <Card title='Case Tracker' description='/bd/kyp-case-tracker'>
              <p className='text-xs mt-2 text-gray-500'>KYP-specific workflow tracker showing where each case is in the KYP process.</p>
            </Card>
            <Card title='Sales Dashboard' description='/bd/dashboard'>
              <p className='text-xs mt-2 text-gray-500'>KPIs: lead count, conversion rate, average ticket size, targets vs achieved.</p>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Pipeline Lead Buckets'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Bucket</th><th className='px-4 py-3 text-left font-medium'>Criteria</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['All', 'All leads assigned to BD'],
                  ['New / Hot', 'Recent leads with no follow-up yet'],
                  ['Follow Up', 'Leads requiring follow-up call/visit'],
                  ['IPD Done', 'Cases where surgery is completed'],
                  ['DNP', 'Did not pick up / unreachable'],
                  ['Junk', 'Invalid or low-quality leads'],
                  ['Lost', 'Lead marked as lost by BD'],
                  ['Closed', 'Completed cases'],
                ].map(([b, c], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-medium'>{b}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Lead Card Display'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Each lead in the pipeline displays a card with key information:</p>
          <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4'>
            <ul className='space-y-1 text-sm text-gray-700 dark:text-gray-300'>
              <li><strong>Header:</strong> Patient name, lead reference ID</li>
              <li><strong>Status:</strong> Case stage badge with color coding</li>
              <li><strong>Details:</strong> Treatment, doctor, hospital, insurance company</li>
              <li><strong>Timeline:</strong> Days since lead creation, next follow-up date</li>
              <li><strong>Financial:</strong> Tentative bill amount (if available)</li>
              <li><strong>Actions:</strong> Quick action buttons (call, message, edit status)</li>
            </ul>
          </div>
        </SubSection>

        <SubSection title='Call Notes'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>BDs can record call notes on leads. Each note captures the conversation summary, follow-up actions, and next call date. Notes are visible to the team lead and insurance team.</p>
          <APITable routes={[
            {method:'GET',path:'/api/call-notes',description:'List call notes for a lead'},
            {method:'POST',path:'/api/call-notes',description:'Create call note'},
          ]} />
        </SubSection>

        <SubSection title='Sales Targets'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Sales targets are set per BD, team, and department head. The Target and BonusRule models track monthly targets with bonus payouts.</p>
          <APITable routes={[
            {method:'GET',path:'/api/targets',description:'List targets'},
            {method:'POST',path:'/api/targets',description:'Create/edit target'},
            {method:'GET',path:'/api/bonus-rules',description:'List bonus rules'},
          ]} />
        </SubSection>
      </>
    )
  },

  'kyp-module': {
    title: 'KYP (Know Your Patient)',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>The KYP (Know Your Patient) module is the first step in the insurance workflow. BD collects patient identity, insurance, and medical details along with supporting documents.</p>

        <SubSection title='KYP Status Lifecycle'>
          <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4'>
            <pre className='text-xs font-mono text-gray-800 dark:text-gray-200'>
PENDING → KYP_DETAILS_ADDED → PRE_AUTH_COMPLETE → FOLLOW_UP_COMPLETE → COMPLETED</pre>
          </div>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Status</th><th className='px-4 py-3 text-left font-medium'>Description</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['PENDING', 'KYP submission created, not yet processed'],
                  ['KYP_DETAILS_ADDED', 'BD has filled KYP basic form with documents'],
                  ['PRE_AUTH_COMPLETE', 'Pre-authorization process completed'],
                  ['FOLLOW_UP_COMPLETE', 'Follow-up with patient completed'],
                  ['COMPLETED', 'KYP process fully done'],
                ].map(([s, d], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200'>{s}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='KYP Basic Form Fields'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Filled by BD at <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>/patient/[leadId]/kyp/basic</code>:</p>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Patient Information' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>patientName (text, required)</li>
                <li>phone (text, conditional visiblity)</li>
                <li>location / City (combobox)</li>
                <li>area (text, required)</li>
                <li>dob (date, required)</li>
                <li>age (number)</li>
                <li>sex (Male/Female/Other)</li>
                <li>aadhar (text, Aadhaar format)</li>
                <li>pan (text, PAN format)</li>
              </ul>
            </Card>
            <Card title='Medical / Insurance' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>insuranceName (text)</li>
                <li>insuranceType (Individual/Group-Corporate)</li>
                <li>doctorName / Surgeon (text, required)</li>
                <li>disease / Treatment (textarea, prefilled)</li>
                <li>remark / Notes (textarea)</li>
              </ul>
            </Card>
            <Card title='Documents Uploaded' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>Insurance card files (multi, pdf/jpg/png, required ≥1)</li>
                <li>Aadhaar card file (single)</li>
                <li>PAN card file (single)</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='KYP Pre-Auth / Hospital Suggestion Form'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Filled by Insurance at <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>/patient/[leadId]/pre-auth</code>:</p>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Policy Fields' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>sumInsured</li><li>balanceInsured</li>
                <li>copay %</li><li>insuranceName</li>
                <li>TPA</li><li>diseaseCapping</li>
              </ul>
            </Card>
            <Card title='Per Hospital Row' description='Insurance suggests hospitals'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>hospitalName (required)</li><li>suggestedDoctor</li>
                <li>tentativeBill (₹)</li><li>roomRent (General/Single/Deluxe/Semi-Private)</li>
                <li>notes</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='KYP APIs'>
          <APITable routes={[
            {method:'POST',path:'/api/kyp/submit',description:'Submit KYP basic form'},
            {method:'GET',path:'/api/kyp',description:'List KYP submissions (role-filtered)'},
            {method:'POST',path:'/api/kyp/upload',description:'Upload KYP documents to S3'},
            {method:'GET',path:'/api/kyp/[id]/edit-document',description:'Get KYP document for editing'},
            {method:'POST',path:'/api/kyp/pre-auth',description:'Submit hospital suggestions and policy fields'},
            {method:'GET',path:'/api/kyp/queries',description:'List KYP queries'},
            {method:'POST',path:'/api/kyp/queries',description:'Insurance raises a query'},
            {method:'POST',path:'/api/kyp/queries/[id]/answer',description:'Answer a KYP query'},
            {method:'POST',path:'/api/kyp/queries/[id]/resolve',description:'Resolve a KYP query'},
          ]} />
        </SubSection>
      </>
    )
  },

  'pre-auth': {
    title: 'Pre-Authorization',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>The Pre-Authorization module handles the approval workflow between BD and Insurance. BD raises pre-auth requests with hospital selection and medical documents; Insurance approves, rejects, or puts on hold.</p>

        <SubSection title='Workflow Overview'>
          <div className='space-y-4 mb-4'>
            <PipelineCard stage='1. BD Raises Pre-Auth' actor='BD' description='BD selects a suggested hospital, room type, sets expected dates, uploads medical documents (prescriptions, investigation reports), and adds disease description.' />
            <PipelineCard stage='2. Insurance Reviews' actor='Insurance' description='Insurance reviews the submission. Can approve (full or temp), reject, or put on hold. Q&A available for clarifications.' />
            <PipelineCard stage='3. Insurance Fills Initiate Form' actor='Insurance' description='Insurance fills the financial initiate form (bill amount, copay, deductions). Required before full approval and before discharge.' />
            <PipelineCard stage='4. Approval Complete' actor='System' description='On full approval, case moves to PREAUTH_COMPLETE. BD can then mark the patient as admitted.' />
          </div>
        </SubSection>

        <SubSection title='Raise Pre-Auth Form (BD)'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Multi-step form at <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>/patient/[leadId]/raise-preauth</code>:</p>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Step 1: Hospital & Timeline' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>selectedHospital (card pick from suggested)</li>
                <li>roomType (select from available room types)</li>
                <li>expectedAdmissionDate (date, required)</li>
                <li>expectedSurgeryDate (date, required)</li>
              </ul>
            </Card>
            <Card title='Step 2: Documents & Medical' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>aadhar number + file (file required)</li>
                <li>pan number + file (file required)</li>
                <li>prescriptionFiles (multi, required ≥1)</li>
                <li>investigationFileUrls (multi)</li>
                <li>diseaseDescription (textarea, required)</li>
                <li>diseaseImages (multi-image)</li>
                <li>notes (textarea)</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Pre-Auth Approval (Insurance)'>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Approve' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>approvalStatus: APPROVED or TEMP_APPROVED</li>
                <li>approvedAmount (number, required)</li>
                <li>approvalNotes (text)</li>
              </ul>
            </Card>
            <Card title='Reject' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>reason (text, required)</li>
                <li>rejectionLetterUrl (file upload)</li>
              </ul>
            </Card>
          </div>
           <Callout type='info' title='Temp Approval'>Temp approval allows partial progress while Insurance finalizes. Full APPROVED requires the Insurance Initiate Form to be filled first (totalBillAmount {'>'} 0, copay set).</Callout>
        </SubSection>

        <SubSection title='Pre-Auth On Hold'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Insurance can pause review without making a decision — e.g., waiting for documents. This sets <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>PreAuthorization.approvalStatus = ON_HOLD</code>. Case stage stays at PREAUTH_RAISED. BD sees the hold + reason as informational.</p>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Action</th><th className='px-4 py-3 text-left font-medium'>API</th><th className='px-4 py-3 text-left font-medium'>Effect</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                <tr><td className='px-4 py-3'>Hold</td><td className='px-4 py-3 font-mono text-xs'>POST /api/pre-auth/[kypSubId]/hold</td><td className='px-4 py-3'>Sets ON_HOLD with reason, notifies BD</td></tr>
                <tr><td className='px-4 py-3'>Release Hold</td><td className='px-4 py-3 font-mono text-xs'>POST /api/pre-auth/[kypSubId]/release-hold</td><td className='px-4 py-3'>Returns status to PENDING</td></tr>
                <tr><td className='px-4 py-3'>Auto-release</td><td className='px-4 py-3 font-mono text-xs'>Approve or Reject API</td><td className='px-4 py-3'>Clears hold automatically</td></tr>
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Insurance Initiate Form'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Financial form filled by Insurance before full approval and discharge. Editable at <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>/patient/[leadId]/pre-auth?initiate=true</code>:</p>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Financial Fields' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>totalBillAmount (number, required)</li>
                <li>discount, otherReductions</li>
                <li>copay (autofilled from pre-auth)</li>
                <li>copayBuffer, deductible</li>
                <li>exceedsPolicyLimit</li>
                <li>policyDeductibleAmount</li>
                <li>totalAuthorizedAmount</li>
                <li>amountToBePaidByInsurance</li>
                <li>roomCategory (autofilled)</li>
                <li>initialApprovalByHospital (file upload)</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Pre-Auth Q&A (Insurance ↔ BD)'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Located on the pre-auth page. Insurance can raise queries; BD answers. Both parties see the full history.</p>
          <APITable routes={[
            {method:'POST',path:'/api/kyp/queries',description:'Insurance raises a query'},
            {method:'POST',path:'/api/kyp/queries/[id]/answer',description:'BD answers query'},
            {method:'POST',path:'/api/kyp/queries/[id]/resolve',description:'Resolve a query'},
          ]} />
        </SubSection>

        <SubSection title='Reset Patient (Danger Action)'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Insurance can roll a case back to HOSPITALS_SUGGESTED (e.g., wrong hospital, policy change). This is the only insurance-driven backward stage transition.</p>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Reset Effect</th><th className='px-4 py-3 text-left font-medium'>What Happens</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                <tr><td className='px-4 py-3'>Case Stage</td><td className='px-4 py-3'>→ HOSPITALS_SUGGESTED (pipeline stays INSURANCE)</td></tr>
                <tr><td className='px-4 py-3'>Pre-Auth Data</td><td className='px-4 py-3'>BD inputs cleared, approval state reset to PENDING</td></tr>
                <tr><td className='px-4 py-3'>Initiate Form</td><td className='px-4 py-3'>Deleted if exists</td></tr>
                <tr><td className='px-4 py-3'>Admission Record</td><td className='px-4 py-3'>Deleted if exists (reset from INITIATED only)</td></tr>
                <tr><td className='px-4 py-3'>Hospital Suggestions</td><td className='px-4 py-3'>Kept (Insurance list)</td></tr>
                <tr><td className='px-4 py-3'>Documents</td><td className='px-4 py-3'>KYP documents kept; prescription/disease files cleared</td></tr>
              </tbody>
            </table>
          </div>
          <Callout type='warning' title='Reset Confirmation'>UI requires typing "yes reset this lead" (case-insensitive) and providing a reason. Submit stays disabled until both validate.</Callout>
        </SubSection>

        <SubSection title='Pre-Auth APIs'>
          <APITable routes={[
            {method:'POST',path:'/api/leads/[id]/raise-preauth',description:'BD raises pre-auth'},
            {method:'POST',path:'/api/pre-auth/[kypSubId]/approve',description:'Insurance approves pre-auth'},
            {method:'POST',path:'/api/pre-auth/[kypSubId]/reject',description:'Insurance rejects pre-auth'},
            {method:'POST',path:'/api/pre-auth/[kypSubId]/hold',description:'Put pre-auth on hold'},
            {method:'POST',path:'/api/pre-auth/[kypSubId]/release-hold',description:'Release pre-auth hold'},
            {method:'POST',path:'/api/pre-auth/[kypSubId]/mark-new-hospital-raised',description:'Mark new hospital pre-auth raised'},
            {method:'POST',path:'/api/insurance-initiate-form',description:'Create initiate form'},
            {method:'PATCH',path:'/api/insurance-initiate-form/[id]',description:'Update initiate form'},
            {method:'POST',path:'/api/leads/[id]/initiate',description:'BD marks patient admitted'},
            {method:'POST',path:'/api/leads/[id]/ipd-mark',description:'BD updates IPD status'},
            {method:'POST',path:'/api/leads/[id]/reset-patient',description:'Reset patient back to HOSPITALS_SUGGESTED'},
            {method:'POST',path:'/api/leads/[id]/mark-discharged',description:'Insurance marks discharged (Step 1)'},
            {method:'GET',path:'/api/leads/[id]/preauth-pdf',description:'Generate pre-auth PDF'},
          ]} />
        </SubSection>
      </>
    )
  },

  'insurance-dashboard': {
    title: 'Insurance Dashboard',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>The Insurance Dashboard is the central work queue for Insurance users. It shows cases by stage bucket with powerful filtering and a two-step discharge system.</p>

        <SubSection title='Dashboard Tabs / Buckets'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Tab</th><th className='px-4 py-3 text-left font-medium'>Stage Condition</th><th className='px-4 py-3 text-left font-medium'>Action</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['KYP Basic Complete', 'caseStage === KYP_BASIC_COMPLETE', 'Add hospitals → suggest hospitals form'],
                  ['Hospitals Suggested', 'caseStage === HOSPITALS_SUGGESTED', 'Wait for BD to raise pre-auth'],
                  ['Pre-Auth Raised', 'caseStage === PREAUTH_RAISED', 'Approve / Reject / Hold / Q&A'],
                  ['Pre-Auth Complete', 'caseStage === PREAUTH_COMPLETE', 'Fill initiate form, wait for BD admission'],
                  ['Initiated', 'caseStage === INITIATED', 'Wait for BD to mark IPD_DONE'],
                  ['To Mark Discharged', 'caseStage === IPD_DONE, no dischargeSheet', 'Mark Discharged dialog'],
                  ['To Fill Sheet', 'caseStage === DISCHARGED, sheet !isFinalized', 'Fill discharge sheet form'],
                  ['Cash Cases', 'flowType === CASH', 'Review cash submissions'],
                ].map(([t, c, a], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-medium'>{t}</td>
                    <td className='px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400'>{c}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Global Filters'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>A filter bar sits above the stat-card tabs with the following options:</p>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Active In (Month + Year)' description='Server-side filter: shows cases that moved (stage history change) in the selected month. Default: current month.' />
            <Card title='BD Filter' description='Server-side filter: ?bdId= filters by assigned BD. Dropdown always shows all BDs.' />
            <Card title='Circle' description='Client-side filter: North/South/East/West/Central. Dropdown shows all circles regardless of other filters.' />
            <Card title='Treatment' description='Client-side filter: filters by treatment type. Dropdown always complete.' />
          </div>
          <p className='text-sm text-gray-500'>Selections persist in <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>localStorage</code> under <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>insurance-dashboard-filters-v1</code>. "Reset" clears back to current month.</p>
        </SubSection>

        <SubSection title='Two-Step Discharge System'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Insurance handles discharge in two explicit steps. There is no automatic transition from IPD Done — Insurance must mark the patient discharged first, and only then fill the full sheet.</p>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Step 1: Mark Discharged' description='Captures discharge date only. Minimal DischargeSheet row created (isFinalized: false). Case stage → DISCHARGED. Pipeline stays INSURANCE. No PL side effects.'>
              <p className='text-xs mt-2 text-gray-500'>API: POST /api/leads/:id/mark-discharged</p>
            </Card>
            <Card title='Step 2: Fill Sheet (Finalize)' description='Full bill breakup, deductions, documents. Sets isFinalized: true. Auto-creates PLRecord. Pipeline moves to PL. Compliance call upserted.'>
              <p className='text-xs mt-2 text-gray-500'>API: POST /api/discharge-sheet</p>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Stage Progress UI'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>The <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>StageProgress</code> component shows 8 steps visually on the patient page:</p>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>#</th><th className='px-4 py-3 text-left font-medium'>Step</th><th className='px-4 py-3 text-left font-medium'>Actor</th><th className='px-4 py-3 text-left font-medium'>Color</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['1', 'Insurance Card Details (KYP)', 'BD', 'Blue'],
                  ['2', 'Suggest Hospitals', 'Insurance', 'Purple'],
                  ['3', 'Pre-Auth Raise', 'BD', 'Blue'],
                  ['4', 'Pre-Auth Approval', 'Insurance', 'Purple'],
                  ['5', 'Insurance Initial Form', 'Insurance', 'Purple'],
                  ['6', 'IPD Details (Mark Admitted)', 'BD', 'Blue'],
                  ['7', 'IPD Mark (Status Update)', 'BD', 'Blue'],
                  ['8', 'Discharge Summary', 'Insurance', 'Purple'],
                ].map(([n, s, a, c], i) => (
                  <tr key={i}><td className='px-4 py-3'>{n}</td><td className='px-4 py-3'>{s}</td><td className='px-4 py-3'>{a}</td><td className='px-4 py-3'><span className={'inline-block px-2 py-0.5 rounded text-xs font-semibold ' + (c === 'Blue' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700')}>{c}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className='text-sm text-gray-500'>Cash flow uses <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>CashStageProgress</code> with 4 steps: IPD Cash Form → Insurance Review → Approved → Discharge.</p>
        </SubSection>

        <SubSection title='Insurance APIs'>
          <APITable routes={[
            {method:'GET',path:'/api/insurance/cases',description:'List insurance cases with date/status filters'},
            {method:'PATCH',path:'/api/insurance/cases/[id]',description:'Update insurance case'},
            {method:'GET',path:'/api/insurance-initiate-form',description:'List initiate forms'},
            {method:'POST',path:'/api/insurance-initiate-form',description:'Create initiate form'},
            {method:'PATCH',path:'/api/insurance-initiate-form/[id]',description:'Update initiate form'},
          ]} />
        </SubSection>
      </>
    )
  },

  'cash-flow': {
    title: 'Cash Flow',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>BD can switch a lead to cash mode at early stages. This bypasses the full insurance pre-auth/approval flow. Cash cases are reviewed by Insurance and discharged with a simplified process.</p>

        <SubSection title='Switching to Cash Mode'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>BD switches the lead by patching <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>flowType: CASH</code>. This sets <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>caseStage → CASH_IPD_PENDING</code>. Reverting to Insurance (PATCH <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>flowType: INSURANCE</code>) returns case stage to KYP_BASIC_COMPLETE or NEW_LEAD.</p>
        </SubSection>

        <SubSection title='Cash Flow Steps'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Stage</th><th className='px-4 py-3 text-left font-medium'>Actor</th><th className='px-4 py-3 text-left font-medium'>Action</th><th className='px-4 py-3 text-left font-medium'>API</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['CASH_IPD_PENDING', 'BD', 'Fill IPD Cash Form', 'IPD Cash Form submit'],
                  ['CASH_IPD_SUBMITTED', 'Insurance', 'Review: Approve or Hold', 'POST /api/leads/:id/cash-review'],
                  ['CASH_ON_HOLD', 'BD', 'Re-edit and resubmit', 'IPD Cash Form re-submit'],
                  ['CASH_APPROVED', 'Insurance', 'Fill cash discharge form', 'POST /api/discharge-sheet-cash'],
                  ['CASH_DISCHARGED', 'System', 'PLRecord auto-created, pipeline → PL', 'Auto'],
                ].map(([s, a, ac, ap], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200'>{s}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{a}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{ac}</td>
                    <td className='px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200'>{ap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='IPD Cash Form Fields (BD)'>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Patient & Treatment' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>patientName, age, sex, circle</li>
                <li>leadRef (read-only)</li>
                <li>alternateContactName / Number</li>
                <li>category, treatment, quantityGrade, anesthesia</li>
                <li>surgeonName, surgeonType</li>
              </ul>
            </Card>
            <Card title='Hospital & Payment' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>hospitalName, hospitalAddress, googleMapLocation</li>
                <li>modeOfPayment (Cash / EMI)</li>
                <li>approvedAmount (required)</li>
                <li>finalBillAmount (required)</li>
                <li>collectedAmount, collectedByMediend, collectedByHospital</li>
                <li>discount, copay, deduction</li>
              </ul>
            </Card>
            <Card title='EMI Fields (if EMI mode)' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>emiAmount (required when EMI)</li>
                <li>processingFee, gst</li>
                <li>subventionFee (computed)</li>
                <li>finalEmiAmount (required)</li>
              </ul>
            </Card>
            <Card title='Timeline & Extras' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>admissionDate, admissionTime (required)</li>
                <li>surgeryDate, surgeryTime (required)</li>
                <li>implant/instrument/consumables text + amount</li>
                <li>notes (textarea)</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Cash Discharge Form (Insurance)'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Field</th><th className='px-4 py-3 text-left font-medium'>Type</th><th className='px-4 py-3 text-left font-medium'>Required</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['dischargeDate', 'date', 'Yes'],
                  ['finalAmount', 'number', 'Yes'],
                  ['remarks', 'textarea', 'No'],
                  ['finalBillUrl', 'file upload', 'No'],
                  ['settlementLetterUrl', 'file upload', 'No'],
                  ['roomRentAmount', 'number', 'No'],
                  ['pharmacyAmount', 'number', 'No'],
                  ['investigationAmount', 'number', 'No'],
                  ['consumablesAmount', 'number', 'No'],
                  ['implantsAmount', 'number', 'No'],
                  ['instrumentsAmount', 'number', 'No'],
                  ['totalFinalBill', 'computed', '—'],
                ].map(([f, t, r], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200'>{f}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{t}</td>
                    <td className='px-4 py-3'><span className={'inline-block px-2 py-0.5 rounded text-xs font-semibold ' + (r === 'Yes' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600')}>{r}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Cash Flow APIs'>
          <APITable routes={[
            {method:'PATCH',path:'/api/leads/[id]',description:'Switch to cash mode (flowType: CASH)'},
            {method:'POST',path:'/api/leads/[id]/cash-review',description:'Insurance approve/hold cash case'},
            {method:'POST',path:'/api/discharge-sheet-cash',description:'Cash discharge creation'},
          ]} />
        </SubSection>
      </>
    )
  },
}
