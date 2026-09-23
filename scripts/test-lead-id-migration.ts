import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { Client } from 'pg'
import { incomingLeadPageQuery, incomingLeadPageSchema } from '../lib/incoming-leads/page-query'

// Deliberately fixed to the disposable local test database. Never loads .env.
const db = new Client({ connectionString: 'postgresql://postgres:local-test-only@127.0.0.1:55439/lead_test' })
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
async function insert(table: string, values: Record<string, unknown>) {
  const { rows } = await db.query(`SELECT column_name, data_type, udt_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1 AND is_nullable = 'NO' AND column_default IS NULL`, [table])
  const data = { ...values }
  for (const column of rows) {
    if (column.column_name in data) continue
    if (column.data_type === 'USER-DEFINED') {
      const enums = await db.query('SELECT enumlabel FROM pg_enum WHERE enumtypid = $1::regtype ORDER BY enumsortorder LIMIT 1', [quote(column.udt_name)])
      data[column.column_name] = enums.rows[0].enumlabel
    } else data[column.column_name] = column.data_type.includes('timestamp') ? new Date('2025-01-01')
      : ['integer', 'double precision', 'numeric'].includes(column.data_type) ? 1
      : column.data_type === 'boolean' ? false : column.data_type === 'jsonb' ? '{}' : `fixture-${column.column_name}`
  }
  const keys = Object.keys(data)
  return db.query(`INSERT INTO ${quote(table)} (${keys.map(quote).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, Object.values(data))
}

async function main() {
  await db.connect()
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
  const oldSchema = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/legacy-source.prisma', '--script'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  await db.query(oldSchema)
  await db.query('SET session_replication_role = replica')
  await insert('User', { id: 'fixture-user', email: 'fixture@example.invalid', name: 'Test BD' })
  await insert('Lead', { id: 'old-newest', leadRef: 'newest', createdDate: new Date('2025-03-01'), bdId: 'fixture-user', patientName: 'Newest' })
  await insert('Lead', { id: 'old-oldest', leadRef: 'oldest', createdDate: new Date('2025-01-01'), bdId: 'fixture-user', patientName: 'Oldest' })
  const dependencies = (await db.query(`SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'leadId' ORDER BY table_name`)).rows
  for (const dependency of dependencies) await insert(dependency.table_name, { id: `fixture-${dependency.table_name}`, leadId: 'old-newest' })
  await insert('IncomingLead', { id: 'incoming-new', processedLeadId: 'old-newest', receivedAt: new Date('2025-03-01'), payload: JSON.stringify({ name: 'Newest' }) })
  await insert('IncomingLead', { id: 'incoming-old', processedLeadId: 'old-oldest', receivedAt: new Date('2025-01-01'), payload: JSON.stringify({ name: 'Oldest' }) })
  await insert('CrmActivityLog', { id: 'fixture-log', entityId: 'old-newest', metadata: JSON.stringify({ leadId: 'old-newest', incomingLeadId: 'incoming-old', nested: { leadIds: ['old-oldest', 'old-newest'] } }) })
  await insert('Notification', { id: 'fixture-notification', userId: 'fixture-user', relatedId: 'old-oldest', link: '/patient/old-oldest?view=details#top' })
  await db.query('SET session_replication_role = origin')
  const migration = readFileSync('prisma/migrations/20260921120000_integer_lead_ids/migration.sql', 'utf8')
  await db.query(`INSERT INTO "IncomingLead" (id, payload, "processedLeadId") VALUES ('orphan', '{}', 'missing-lead')`)
  await assert.rejects(db.query(migration), /Orphan reference/)
  await db.query('ROLLBACK')
  assert.equal((await db.query(`SELECT data_type FROM information_schema.columns WHERE table_name = 'Lead' AND column_name = 'id'`)).rows[0].data_type, 'text')
  await db.query(`DELETE FROM "IncomingLead" WHERE id = 'orphan'`)
  await db.query(migration)
  const statusMigration = readFileSync('prisma/migrations/20260922100000_lead_status_hierarchy/migration.sql', 'utf8')
  await db.query(statusMigration)
  assert.equal((await db.query('SELECT count(*)::int AS count FROM "status_category"')).rows[0].count, 4)
  assert.equal((await db.query('SELECT count(*)::int AS count FROM "status"')).rows[0].count >= 34, true)
  assert.equal((await db.query('SELECT "statusId" FROM "Lead" WHERE id = 1')).rows[0].statusId > 0, true)
  assert.deepEqual((await db.query('SELECT id, "legacyId" FROM "Lead" ORDER BY id')).rows,
    [{ id: 1, legacyId: 'old-oldest' }, { id: 2, legacyId: 'old-newest' }])
  const createdLead = await insert('Lead', { leadRef: 'auto-id', patientName: 'Auto ID', bdId: 'fixture-user', createdById: 'fixture-user', updatedById: 'fixture-user' })
  assert.equal(createdLead.rows[0].id, 3)
  for (const dependency of dependencies) {
    assert.equal((await db.query(`SELECT "leadId" FROM ${quote(dependency.table_name)} LIMIT 1`)).rows[0].leadId, 2, dependency.table_name)
  }
  assert.deepEqual((await db.query('SELECT id, "processedLeadId" FROM "IncomingLead" ORDER BY id')).rows,
    [{ id: 1, processedLeadId: 1 }, { id: 2, processedLeadId: 2 }])
  assert.deepEqual((await db.query('SELECT metadata FROM "CrmActivityLog" WHERE id = $1', ['fixture-log'])).rows[0].metadata,
    { leadId: 2, incomingLeadId: 1, nested: { leadIds: [1, 2] } })
  assert.equal((await db.query('SELECT "relatedId" FROM "Notification" WHERE id = $1', ['fixture-notification'])).rows[0].relatedId, '1')
  assert.equal((await db.query('SELECT link FROM "Notification" WHERE id = $1', ['fixture-notification'])).rows[0].link, '/patient/1?view=details#top')
  for (let index = 0; index < 249; index++) {
    await db.query(`INSERT INTO "IncomingLead" (payload, "receivedAt", "selectedBdUserId", status)
      VALUES ($1, $2, $3, $4)`, [JSON.stringify({ name: `Patient ${index}`, Circle: '3' }), new Date('2025-04-01'), 'fixture-user', index % 2 ? 'FAILED' : 'PENDING'])
  }
  const query = async (values: object, scope: string[] | null = null) => {
    const sql = incomingLeadPageQuery(incomingLeadPageSchema.parse(values), scope, null)
    return (await db.query(sql.text, sql.values)).rows[0]
  }
  const first = await query({ pageSize: 100 })
  const second = await query({ pageSize: 100, page: 2 })
  const third = await query({ pageSize: 100, page: 3 })
  assert.equal(first.total, 251)
  assert.equal(first.ids.length, 100)
  assert.equal(second.ids.length, 100)
  assert.equal(third.ids.length, 51)
  assert.equal(new Set([...first.ids, ...second.ids, ...third.ids]).size, 251)
  assert.equal(first.ids[0], 251)
  assert.equal((await query({ pageSize: 100, page: 999 })).page, 3)
  assert.equal((await query({ pageSize: 100 }, [])).total, 0)
  assert.equal((await query({ filters: [{ field: 'circle', type: 'multiSelect', value: ['Pune'] }] })).total, 249)
  assert.equal((await query({ searchColumn: 'patientName', searchValue: 'Oldest' })).total, 1)
  assert.equal((await query({ filters: [{ field: 'status', type: 'multiSelect', value: ['FAILED'] }] })).total, 124)
  assert.equal((await query({ filters: [{ field: 'receivedAt', type: 'dateRange', value: ['2025-04-01', '2025-04-01'] }] })).total, 249)
  assert.equal((await query({ searchColumn: 'patientName', searchValue: "%' OR 1=1 --" })).total, 0)
  assert.equal(incomingLeadPageSchema.safeParse({ pageSize: 100000 }).success, false)
  assert.equal(incomingLeadPageSchema.safeParse({ page: 1.5 }).success, false)
  assert.equal(incomingLeadPageSchema.safeParse({ sortBy: 'id; DROP TABLE Lead' }).success, false)
  await db.query(`UPDATE "IncomingLead" SET "normalizedPhone" = '9876501234' WHERE id = 1`)
  assert.equal((await query({ searchColumn: 'normalizedPhone', searchValue: '9876501234' }, [])).total, 1)
  assert.equal((await query({ searchColumn: 'normalizedPhone', searchValue: '98765' })).total, 0)
  assert.equal(first.failed, 124)
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
  await db.query(oldSchema)
  await db.query(migration)
  await db.query(statusMigration)
  assert.equal((await db.query(`INSERT INTO "IncomingLead" (payload) VALUES ('{}') RETURNING id`)).rows[0].id, 1)
  console.log(`PASS: ${dependencies.length} dependent tables, chronological IDs, sequences on populated/empty tables, orphan rollback, nested JSON, saved links, 100/100/51 pagination, summary counts, sorting, filtering, search, and access scope.`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => db.end())
