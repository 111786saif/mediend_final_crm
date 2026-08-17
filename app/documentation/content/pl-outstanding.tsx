// @ts-nocheck
'use client'

import { SubSection, APITable, Card, Callout, PipelineCard } from '../components/docs-components'

export const plSections = {
  'pl-dashboard': {
    title: 'P&L Dashboard',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>The P&L Dashboard shows all discharged cases with pipeline stage PL or COMPLETED. KPIs include total profit, average ticket size, and pending payout counts. Each row links to the PL Record edit page.</p>

        <SubSection title='How Cases Enter PL'>
          <div className='space-y-3 text-gray-700 dark:text-gray-300 mb-4'>
            <PipelineCard stage='Auto (Discharge Sheet)' actor='System' description='When Insurance creates a Discharge Sheet → PLRecord auto-created, pipelineStage → PL, PL team notified.' />
            <PipelineCard stage='Manual "Create PNL"' actor='PL_HEAD / INSURANCE_HEAD / ADMIN' description='Button on DischargeSheetView calls POST /api/discharge-sheet/[id]/create-pnl. Creates PLRecord if none exists.' />
            <PipelineCard stage='Cash Discharge' actor='Insurance' description='POST /api/discharge-sheet-cash also auto-creates PLRecord with pipelineStage → PL.' />
          </div>
        </SubSection>

        <SubSection title='PL Dashboard Features'>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='KPIs' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>Sum of finalProfit across all cases</li>
                <li>Average ticket size (billAmount)</li>
                <li>Pending payout counts (hospital/doctor/mediend)</li>
                <li>Date range filtering</li>
              </ul>
            </Card>
            <Card title='Actions' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>Click row → /pl/record/[leadId] to edit</li>
                <li>Filter by month, BD, circle, treatment</li>
                <li>Export data</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='PL APIs'>
          <APITable routes={[
            {method:'GET',path:'/api/pnl/overview',description:'PL overview KPIs'},
            {method:'GET',path:'/api/pnl/entries',description:'List P&L entries'},
            {method:'POST',path:'/api/pnl/entries',description:'Create P&L entry'},
            {method:'GET',path:'/api/pnl/surgery',description:'Surgery-wise PL'},
            {method:'GET',path:'/api/pnl/department/[dept]',description:'Department PL'},
            {method:'GET',path:'/api/pnl/targeted/overview',description:'Targeted PL overview'},
            {method:'GET',path:'/api/pnl/targeted/comparison',description:'Budget vs actual comparison'},
            {method:'GET',path:'/api/pnl/targeted/entries',description:'Targeted PL entries'},
            {method:'GET',path:'/api/pnl/categories',description:'List P&L categories'},
            {method:'POST',path:'/api/pnl/categories',description:'Create P&L category'},
            {method:'GET',path:'/api/pnl/config',description:'Get P&L configuration'},
          ]} />
        </SubSection>
      </>
    )
  },

  'pl-record': {
    title: 'P&L Record Entry',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>PLRecord tracks per-case profit, payout statuses, and revenue splits. Auto-created when discharge sheet is finalized. Editable at <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>/pl/record/[leadId]</code> via PATCH /api/leads/[id] with plRecord data.</p>

        <SubSection title='PLRecord Fields'>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Identity & People' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>month, surgeryDate, status, paymentType</li>
                <li>approvedOrCash, paymentCollectedAt</li>
                <li>managerRole, managerName, bdmName</li>
                <li>patientName, patientPhone, doctorName, hospitalName</li>
              </ul>
            </Card>
            <Card title='Case Info' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>category, treatment, circle, leadSource</li>
                <li>totalAmount, billAmount, cashPaidByPatient</li>
                <li>cashOrDedPaid</li>
              </ul>
            </Card>
            <Card title='Cost Lines' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>referralAmount, cabCharges</li>
                <li>implantCost, dcCharges</li>
                <li>doctorCharges</li>
              </ul>
            </Card>
            <Card title='Revenue Split & Profit' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>hospitalSharePct / hospitalShareAmount</li>
                <li>mediendSharePct / mediendShareAmount</li>
                <li>mediendNetProfit, finalProfit</li>
              </ul>
            </Card>
            <Card title='Payout Tracking' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>hospitalPayoutStatus: PENDING / PARTIAL / PAID</li>
                <li>doctorPayoutStatus: PENDING / PARTIAL / PAID</li>
                <li>mediendInvoiceStatus: PENDING / SENT / PAID</li>
                <li>hospitalAmountPending, doctorAmountPending</li>
              </ul>
            </Card>
            <Card title='Meta' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>remarks (textarea)</li>
                <li>closedAt (date — auto-set when both payouts = PAID)</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Profit Calculation'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Calculated automatically on PL edit save:</p>
          <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4'>
            <pre className='text-sm font-mono text-gray-800 dark:text-gray-200'>
{`hospAmount   = billAmount × hospitalSharePct / 100
medAmount    = billAmount × mediendSharePct / 100
costs        = referralAmount + cabCharges + dcCharges + doctorCharges + implantCost
profit       = medAmount - costs
mediendNetProfit = manual override OR profit
closedAt     = auto-set when hospitalPayoutStatus + doctorPayoutStatus both = PAID`}
            </pre>
          </div>
        </SubSection>

        <SubSection title='Payment Installments'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Granular installment payments tracked via the PaymentInstallment model:</p>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Field</th><th className='px-4 py-3 text-left font-medium'>Description</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['payee', 'HOSPITAL / DOCTOR / MEDIEND'],
                  ['mode', 'CASH / UPI / NEFT / RTGS / CHEQUE / CARD'],
                  ['amount', 'Installment amount'],
                  ['date', 'Payment date'],
                  ['reference', 'Transaction reference/UTR'],
                ].map(([f, d], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs font-medium'>{f}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <APITable routes={[
            {method:'GET',path:'/api/installments',description:'List payment installments for a lead'},
            {method:'POST',path:'/api/installments',description:'Record payment installment'},
            {method:'DELETE',path:'/api/installments/[id]',description:'Delete installment'},
          ]} />
        </SubSection>

        <SubSection title='PL APIs'>
          <APITable routes={[
            {method:'PATCH',path:'/api/leads/[id]',description:'Update lead + plRecord fields'},
            {method:'POST',path:'/api/pnl/entries',description:'Create P&L entry'},
            {method:'GET',path:'/api/pnl/entries',description:'List P&L entries'},
            {method:'POST',path:'/api/discharge-sheet/[id]/create-pnl',description:'Manual PL creation from discharge'},
          ]} />
        </SubSection>
      </>
    )
  },

  'pl-surgery': {
    title: 'Surgery P&L',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Surgery-wise P&L dashboard tracks per-surgery profitability at the hospital case level. Provides revenue tracking, profit calculations, and doctor/hospital-wise breakdowns.</p>

        <SubSection title='Key Features'>
          <ul className='space-y-2 text-gray-700 dark:text-gray-300 mb-6'>
            <li>Revenue tracking per surgery: bill amount, share percentages, deductions</li>
            <li>Profit calculation: Mediend share minus all applicable costs</li>
            <li>Date range filtering for surgery P&L reports</li>
            <li>Doctor-wise and hospital-wise profit breakdown</li>
          </ul>
        </SubSection>

        <SubSection title='Surgery P&L APIs'>
          <APITable routes={[
            {method:'GET',path:'/api/analytics/pl-surgery-dashboard',description:'Surgery dashboard data'},
            {method:'GET',path:'/api/analytics/pl-pipeline-stats',description:'P&L pipeline statistics'},
            {method:'GET',path:'/api/pnl/surgery',description:'Surgery-wise P&L entries'},
          ]} />
        </SubSection>
      </>
    )
  },
}

export const outstandingSections = {
  'outstanding-dashboard': {
    title: 'Outstanding Dashboard',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Tracks post-PL payments for discharged cases with pipelineStage PL or COMPLETED. Shows pending amounts for hospital payout, doctor payout, and Mediend invoice status.</p>

        <SubSection title='What is Outstanding'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Post-P&L money still to be collected or paid out for discharged cases. The Outstanding Dashboard tracks hospital payout, doctor payout, Mediend invoice status, and a "payment received" flag with follow-up remarks.</p>
        </SubSection>

        <SubSection title='Dashboard Features'>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Data Source' description='Leads with dischargeSheet present and pipelineStage in [PL, COMPLETED] via GET /api/outstanding'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>PLRecord pending amounts and payout statuses</li>
                <li>OutstandingCase model with financial snapshot</li>
                <li>outstandingDays computed (surgery date → today)</li>
              </ul>
            </Card>
            <Card title='KPIs & Actions' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>Pending payout counts and amounts</li>
                <li>Click row → /outstanding/edit/[leadId]</li>
                <li>Sync button to refresh from PLRecord</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Outstanding APIs'>
          <APITable routes={[
            {method:'GET',path:'/api/outstanding',description:'List outstanding cases'},
            {method:'PATCH',path:'/api/outstanding/[leadId]',description:'Update payout statuses'},
            {method:'POST',path:'/api/outstanding/sync',description:'Sync PLRecord to OutstandingCase'},
          ]} />
        </SubSection>
      </>
    )
  },

  'outstanding-edit': {
    title: 'Edit Outstanding',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Edit payout statuses and follow-up notes for outstanding cases. Accessible to OUTSTANDING_HEAD and ADMIN only. Prerequisite: Lead must have a dischargeSheet.</p>

        <SubSection title='Editable Fields'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Source</th><th className='px-4 py-3 text-left font-medium'>Field</th><th className='px-4 py-3 text-left font-medium'>Values</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['PLRecord', 'hospitalPayoutStatus', 'PENDING / PARTIAL / PAID'],
                  ['PLRecord', 'doctorPayoutStatus', 'PENDING / PARTIAL / PAID'],
                  ['PLRecord', 'mediendInvoiceStatus', 'PENDING / SENT / PAID'],
                  ['PLRecord', 'hospitalAmountPending', 'number'],
                  ['PLRecord', 'doctorAmountPending', 'number'],
                  ['OutstandingCase', 'paymentReceived', 'Received / Pending (boolean)'],
                  ['OutstandingCase', 'remark2', 'textarea (follow-up notes)'],
                ].map(([src, f, v], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400'>{src}</td>
                    <td className='px-4 py-3 font-medium text-gray-800 dark:text-gray-200'>{f}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Outstanding Sync'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>The sync process reads PLRecord rows and creates/updates OutstandingCase with a financial snapshot. It computes <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>outstandingDays</code> (surgery date → today). Does not require a discharge sheet — only PLRecord.</p>
          <APITable routes={[
            {method:'POST',path:'/api/outstanding/sync',description:'Sync PLRecord → OutstandingCase'},
            {method:'PATCH',path:'/api/outstanding/[leadId]',description:'Update outstanding case'},
          ]} />
        </SubSection>
      </>
    )
  },
}
