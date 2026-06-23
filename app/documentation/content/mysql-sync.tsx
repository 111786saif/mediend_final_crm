// @ts-nocheck
'use client'

import { SubSection, APITable, Card, Callout } from '../components/docs-components'

export const mysqlSyncSection = {
  'mysql-sync': {
    title: 'MySQL Legacy Sync',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>The MySQL Lead Sync system transfers patient data from a legacy MySQL/MariaDB database to the PostgreSQL database. It supports historic backfill, incremental sync, and automated cron-based scheduling.</p>

        <SubSection title='Architecture Overview'>
          <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4'>
            <pre className='text-xs font-mono text-gray-800 dark:text-gray-200'>
{`MySQL (Source) ──→ Sync Script ──→ PostgreSQL (Target)
kundkun_mediendcrm              Prisma ORM
  ├── lead table                  ├── Lead model (80+ fields)
  └── lead_remarks table          └── LeadRemark model

SyncState tracks lastSyncedDate + lastSyncedId for incremental sync

Webhook path: External → IncomingLead → process → Lead`}
            </pre>
          </div>
        </SubSection>

        <SubSection title='Prerequisites'>
          <div className='space-y-3 text-gray-700 dark:text-gray-300 mb-4'>
            <p><strong>1. Read-only MySQL user</strong> with SELECT permissions on <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>lead</code> and <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>lead_remarks</code> tables.</p>
            <p><strong>2. Environment variable:</strong></p>
            <pre className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'>MYSQL_SOURCE_URL="mysql://lead_reader:password@kundkundtc.in:3306/kundkun_mediendcrm"</pre>
            <p><strong>3. Database migration:</strong></p>
            <pre className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'>npx prisma db push</pre>
          </div>
        </SubSection>

        <SubSection title='Sync Types'>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Historic Sync (Backfill)' description='npm run sync:historic:leads [fromDate]'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>One-time full backfill from a start date</li>
                <li>Queries leads where received date ≥ fromDate</li>
                <li>Default from: 2025-12-01 (or HISTORIC_SYNC_FROM_DATE env)</li>
                <li>Processes in batches of 2500 records</li>
                <li>Syncs associated lead_remarks</li>
                <li>Updates SyncState after each batch</li>
              </ul>
            </Card>
            <Card title='Incremental Sync' description='npm run sync:leads'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>Sync only new/updated leads since last sync</li>
                <li>Reads SyncState.lastSyncedDate as cursor</li>
                <li>Updates existing leads or creates new ones</li>
                <li>Processes up to 2500 records per run</li>
                <li>Updates SyncState on completion</li>
                <li>Run via 5-minute cron for continuous sync</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Setup Guide'>
          <div className='space-y-4 text-gray-700 dark:text-gray-300 mb-4'>
            <p><strong>Step 0: Verify MySQL Connection (Recommended)</strong></p>
            <pre className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'>npm run verify:mysql</pre>
            <p>This checks: MySQL connection, database/table existence, SELECT permissions, sample data, row counts, date-based queries, and required fields.</p>

            <p><strong>Step 1: Run Historic Sync</strong></p>
            <pre className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'>npm run sync:historic:leads 2025-12-01</pre>

            <p><strong>Step 2: Set Up Cron for Incremental Sync</strong></p>
            <pre className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'>{'*/5 * * * * cd /path/to/mediend-crm-v2 && npm run sync:leads >> logs/sync-leads.log 2>&1'}</pre>
          </div>
        </SubSection>

        <SubSection title='Field Mapping'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>All 68 MySQL fields are mapped to the Prisma Lead model. Key mappings:</p>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>MySQL Field</th><th className='px-4 py-3 text-left font-medium'>Prisma Field</th><th className='px-4 py-3 text-left font-medium'>Notes</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['id', 'leadRef', 'Unique identifier from legacy system'],
                  ['Patient_Name', 'patientName', 'Patient full name'],
                  ['Patient_Number', 'phoneNumber', 'Conditional visibility in UI'],
                  ['BDM', 'bdId', 'Matched by name to User with role BD'],
                  ['Status', 'status', 'MySQL status code mapped via mysql-code-mappings.ts'],
                  ['Circle', 'circle', 'Enum: North/South/East/West/Central'],
                  ['Lead_Date', 'createdDate', 'Used as cursor for incremental sync'],
                  ['opdHospital, ipdHospital', 'opdHospital, ipdHospital', 'OPD/IPD hospital references'],
                  ['Remarks (lead_remarks)', 'LeadRemark', 'Separate model linked by leadRef'],
                ].map(([m, p, n], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200'>{m}</td>
                    <td className='px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200'>{p}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className='text-sm text-gray-500'>See <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>lib/sync/mysql-lead-mapper.ts</code> for complete mapping.</p>
        </SubSection>

        <SubSection title='Sync State Tracking'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>The <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>SyncState</code> model tracks:</p>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Field</th><th className='px-4 py-3 text-left font-medium'>Description</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['lastSyncedDate', 'Last received date processed'],
                  ['lastSyncedId', 'Last MySQL lead.id processed'],
                  ['recordsCount', 'Total records synced'],
                  ['lastRunAt', 'Timestamp of last sync run'],
                ].map(([f, d], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs font-medium'>{f}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Resetting for Full Re-import'>
          <div className='space-y-3 text-gray-700 dark:text-gray-300 mb-4'>
            <p><strong>1. Truncate PostgreSQL data:</strong></p>
            <pre className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'>psql "$DATABASE_URL" -f scripts/db/truncate-leads-for-reimport.sql</pre>
            <p>This deletes all LeadRemark and Lead rows and removes the mysql_leads SyncState row.</p>
            <p><strong>2. Run historic sync:</strong></p>
            <pre className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'>npm run sync:historic:leads 2025-12-01</pre>
            <p><strong>3. Then use incremental sync or 5-minute cron to keep data in sync.</strong></p>
          </div>
        </SubSection>

        <SubSection title='Error Handling'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Issue</th><th className='px-4 py-3 text-left font-medium'>Behavior</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['Connection error', 'Script fails with clear error message'],
                  ['Missing BD user', 'Error logged, lead skipped'],
                  ['Duplicate leads', 'Existing leads updated with new data'],
                  ['Invalid data', 'Errors logged per record, sync continues'],
                ].map(([i, b], idx) => (
                  <tr key={idx} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-medium'>{i}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Performance'>
          <div className='grid md:grid-cols-3 gap-4 mb-4'>
            <Card title='Batch Size' description='2500 records per batch' />
            <Card title='Connection Pool' description='10 concurrent connections' />
            <Card title='Incremental Sync' description='~1-5 min for 2500 records' />
          </div>
          <p className='text-sm text-gray-500'>Historic sync takes hours for large datasets. Incremental sync should be fast.</p>
        </SubSection>

        <SubSection title='Key Files'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>File</th><th className='px-4 py-3 text-left font-medium'>Purpose</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['lib/mysql-source-client.ts', 'MySQL connection pool and query utilities'],
                  ['lib/sync/mysql-lead-mapper.ts', 'Field mapping logic (68 MySQL fields → Prisma)'],
                  ['scripts/sync-mysql-leads.ts', 'Incremental sync script'],
                  ['scripts/sync-historic-mysql-leads.ts', 'Historic sync script'],
                  ['scripts/sync-leads-wrapper.sh', 'Cron wrapper with locking and logging'],
                  ['prisma/schema.prisma', 'Extended Lead model, LeadRemark, SyncState'],
                  ['scripts/db/truncate-leads-for-reimport.sql', 'PostgreSQL truncation for re-import'],
                ].map(([f, p], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200'>{f}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <Callout type='info' title='Security'>The sync uses a read-only MySQL user (SELECT only). No writes to the source database. Connection credentials stored in environment variables (never committed to version control).</Callout>
      </>
    )
  },
}
