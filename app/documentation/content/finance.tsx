// @ts-nocheck
'use client'

import { SubSection, APITable, Card, Callout } from '../components/docs-components'

export const financeSections = {
  'finance-ledger': {
    title: 'Ledger & Accounting',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Double-entry bookkeeping system with Credit, Debit, and Self-Transfer transaction types. Features a full approval workflow, edit request cycles (up to 5), soft delete, and complete audit trail.</p>

        <SubSection title='Ledger Transaction Types'>
          <div className='grid md:grid-cols-3 gap-4 mb-4'>
            <Card title='CREDIT' description='Money received (e.g., client payment, revenue)' />
            <Card title='DEBIT' description='Money spent (e.g., expense, vendor payment)' />
            <Card title='SELF_TRANSFER' description='Transfer between internal accounts/modes (no P&L impact)' />
          </div>
        </SubSection>

        <SubSection title='Transaction Lifecycle'>
          <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4'>
            <pre className='text-xs font-mono text-gray-800 dark:text-gray-200'>
{`DRAFT → PENDING (with approval needed) → APPROVED → COMPLETED
  │          │
  └─ DELETED └─ REJECTED

Edit Request Flow (max 5 cycles):
ORIGINAL → EDIT_REQUESTED → APPROVED_EDIT → RE-APPROVED
           │
           └─ REJECTED_EDIT`}
            </pre>
          </div>
          <div className='space-y-3 text-gray-700 dark:text-gray-300 mb-4'>
            <p><strong>1. Create:</strong> User creates entry with type (CREDIT/DEBIT/TRANSFER), amount, party, head, payment mode, description.</p>
            <p><strong>2. Approval:</strong> Debit entries require approval (FINANCE_HEAD, ADMIN). Credit entries post immediately.</p>
            <p><strong>3. Edit Request:</strong> User can request edits on approved entries. Approver can accept/reject. Up to 5 edit cycles.</p>
            <p><strong>4. Delete:</strong> Soft delete with reason. Does not remove from audit log.</p>
            <p><strong>5. Audit:</strong> Every action logged in LedgerAuditLog — creation, approval, edit, delete, undo.</p>
          </div>
        </SubSection>

        <SubSection title='Masters'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Transactions reference several master tables:</p>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='PartyMaster' description='Vendors, clients, suppliers, buyers — categorized as BUYER/SELLER/VENDOR/CLIENT/SUPPLIER/OTHER' />
            <Card title='HeadMaster' description='Transaction category heads (e.g., Rent, Salary, Marketing, Professional Fees)' />
            <Card title='PaymentModeMaster' description='Bank accounts/cash modes with running balance tracking' />
            <Card title='PaymentTypeMaster' description='Expense type classification' />
          </div>
        </SubSection>

        <SubSection title='Ledger APIs'>
          <APITable routes={[
            {method:'GET',path:'/api/finance/ledger',description:'List ledger entries with filters'},
            {method:'POST',path:'/api/finance/ledger',description:'Create ledger entry'},
            {method:'GET',path:'/api/finance/ledger/[id]',description:'Get entry details'},
            {method:'DELETE',path:'/api/finance/ledger/[id]',description:'Delete ledger entry'},
            {method:'POST',path:'/api/finance/ledger/[id]/approve',description:'Approve debit entry'},
            {method:'POST',path:'/api/finance/ledger/[id]/undo',description:'Undo approval'},
            {method:'POST',path:'/api/finance/ledger/[id]/request-edit',description:'Request edit on entry'},
            {method:'POST',path:'/api/finance/ledger/[id]/approve-edit',description:'Approve edit request'},
            {method:'POST',path:'/api/finance/ledger/[id]/reject-edit',description:'Reject edit request'},
            {method:'POST',path:'/api/finance/ledger/bulk-approve',description:'Bulk approve entries'},
            {method:'GET',path:'/api/finance/reports/summary',description:'Financial summary report'},
            {method:'GET',path:'/api/finance/reports/entries',description:'Financial entries report'},
          ]} />
        </SubSection>
      </>
    )
  },

  'finance-parties': {
    title: 'Parties & Heads',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Master data management for parties (vendors, clients), accounting heads, payment modes, and salary structures. These masters are referenced by ledger entries and payroll.</p>

        <SubSection title='Masters Overview'>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='PartyMaster' description='Parties/directory: BUYER, SELLER, VENDOR, CLIENT, SUPPLIER, OTHER. Each party has contact details and linked transactions.' />
            <Card title='HeadMaster' description='Accounting heads for categorizing transactions. Used in ledger entries to group expenses/revenues.' />
            <Card title='PaymentModeMaster' description='Payment modes (bank accounts, cash). Track running balance per mode for reconciliation.' />
            <Card title='SalaryStructure' description='Employee salary components: CTC, basic, HRA, PF, ESIC, TDS, etc. Used for monthly payroll generation.' />
          </div>
        </SubSection>

        <SubSection title='Parties & Heads APIs'>
          <APITable routes={[
            {method:'GET',path:'/api/finance/parties',description:'List parties'},
            {method:'POST',path:'/api/finance/parties',description:'Create party'},
            {method:'GET',path:'/api/finance/parties/[id]',description:'Get party details'},
            {method:'GET',path:'/api/finance/heads',description:'List accounting heads'},
            {method:'POST',path:'/api/finance/heads',description:'Create head'},
            {method:'GET',path:'/api/finance/payment-types',description:'List payment types'},
            {method:'GET',path:'/api/finance/payment-modes',description:'List payment modes'},
            {method:'POST',path:'/api/finance/payment-modes',description:'Create payment mode'},
            {method:'GET',path:'/api/finance/salary-structure',description:'List salary structures'},
            {method:'POST',path:'/api/finance/salary-structure',description:'Create salary structure'},
          ]} />
        </SubSection>
      </>
    )
  },

  'finance-projects': {
    title: 'Projects & Inventory',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Project accounting tracks revenue-generating projects and sales records. Inventory management handles multi-location warehouses with purchases and issues.</p>

        <SubSection title='Project Accounting'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Projects are tracked with revenue categories. Sales entries record booked revenue (does not affect bank balance — that's the ledger's role).</p>
        </SubSection>

        <SubSection title='Inventory Management'>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Location Hierarchy' description='Multi-warehouse: LocationMaster with parent-child (e.g., Region → City → Warehouse → Shelf)' />
            <Card title='Stock Movement' description='ItemMaster tracks inventory items. StockMovement records purchases (stock in) and issues (stock out).' />
          </div>
        </SubSection>

        <SubSection title='Projects & Inventory APIs'>
          <APITable routes={[
            {method:'GET',path:'/api/finance/projects',description:'List projects'},
            {method:'POST',path:'/api/finance/projects',description:'Create project'},
            {method:'GET',path:'/api/finance/projects/[id]',description:'Get project'},
            {method:'PATCH',path:'/api/finance/projects/[id]',description:'Update project'},
            {method:'GET',path:'/api/finance/sales',description:'List sales records'},
            {method:'POST',path:'/api/finance/sales',description:'Create sale transaction'},
            {method:'GET',path:'/api/finance/sales/[id]',description:'Get sale details'},
            {method:'GET',path:'/api/finance/inventory/items',description:'List inventory items'},
            {method:'POST',path:'/api/finance/inventory/items',description:'Create item'},
            {method:'GET',path:'/api/finance/inventory/purchases',description:'List purchases'},
            {method:'POST',path:'/api/finance/inventory/purchases',description:'Create purchase'},
            {method:'GET',path:'/api/finance/inventory/issues',description:'List issues'},
            {method:'POST',path:'/api/finance/inventory/issues',description:'Create issue'},
          ]} />
        </SubSection>
      </>
    )
  },

  'finance-payroll': {
    title: 'Finance Payroll',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Finance-level payroll management: batch generation, CSV export, attendance summary, and bulk status updates. This is the Finance team's view of the payroll system (separate from HR's payroll setup).</p>

        <SubSection title='Finance Payroll Flow'>
          <div className='space-y-3 text-gray-700 dark:text-gray-300 mb-4'>
            <p><strong>1. Attendance Summary:</strong> Fetch attendance data for payroll period via GET /api/finance/payroll/attendance-summary.</p>
            <p><strong>2. Generate Payroll:</strong> POST /api/finance/payroll/generate creates payroll records for all active employees with calculated deductions.</p>
            <p><strong>3. Export CSV:</strong> POST /api/finance/payroll/export-csv generates a CSV file for bank processing.</p>
            <p><strong>4. Status Updates:</strong> Finance can update payroll statuses as payments are processed.</p>
          </div>
        </SubSection>

        <SubSection title='Finance Payroll APIs'>
          <APITable routes={[
            {method:'GET',path:'/api/finance/payroll',description:'Finance payroll view'},
            {method:'POST',path:'/api/finance/payroll/generate',description:'Generate payroll batch'},
            {method:'POST',path:'/api/finance/payroll/export-csv',description:'Export payroll CSV'},
            {method:'GET',path:'/api/finance/payroll/attendance-summary',description:'Attendance summary for payroll'},
          ]} />
        </SubSection>
      </>
    )
  },
}
