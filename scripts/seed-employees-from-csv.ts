/**
 * Seed Users and Employees from employee-backup-supabase.csv (or similar).
 * CSV columns: email, name, role, employee_code, bd_number
 *
 * Local:
 *   bun scripts/seed-employees-from-csv.ts path/to/employee-backup-supabase.csv
 *
 * Docker:
 *   docker compose --profile tools run --rm \
 *     -v "/root/mediend.workspace/scripts/db/employee-backup-supabase.csv:/app/employees.csv" \
 *     seed-csv /app/employees.csv
 */
import 'dotenv/config'
import { PrismaClient, UserRole } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pkg from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import bcrypt from 'bcryptjs'

const { Pool } = pkg

const DEFAULT_PASSWORD = '12345678'
const PLACEHOLDER_EMAIL = 'seed-placeholder@mediend.local'
const MD_EMP_ID = 1000

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: [],
})

interface CsvRow {
  email: string
  name: string
  role: string
  employeeCode: string
  bdNumber: number | null
  empId: number
}

const ROLE_MAP: Record<string, UserRole> = {
  MD: 'MD',
  ADMIN: 'ADMIN',
  EXECUTIVE_ASSISTANT: 'EXECUTIVE_ASSISTANT',
  SALES_HEAD: 'SALES_HEAD',
  CATEGORY_MANAGER: 'CATEGORY_MANAGER',
  ASSISTANT_CATEGORY_MANAGER: 'ASSISTANT_CATEGORY_MANAGER',
  TEAM_LEAD: 'TEAM_LEAD',
  BD: 'BD',
  INSURANCE_HEAD: 'INSURANCE_HEAD',
  PL_HEAD: 'PL_HEAD',
  OUTSTANDING_HEAD: 'OUTSTANDING_HEAD',
  HR_HEAD: 'HR_HEAD',
  FINANCE_HEAD: 'FINANCE_HEAD',
  DIGITAL_MARKETING_HEAD: 'DIGITAL_MARKETING_HEAD',
  DIGITAL_HEAD: 'DIGITAL_MARKETING_HEAD',
  COMPLIANCE_HEAD: 'COMPLIANCE_HEAD',
  ACCESS_MATRIX: 'ACCESS_MATRIX',
  IT_HEAD: 'IT_HEAD',
  LOAN_DEMAT_HEAD: 'LOAN_DEMAT_HEAD',
  USER: 'USER',
  TESTER: 'TESTER',
}

function mapRole(role: string): UserRole {
  return ROLE_MAP[(role || '').trim()] ?? 'USER'
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

function parseCsv(raw: string): CsvRow[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase())
  const idx = {
    email: header.indexOf('email'),
    name: header.indexOf('name'),
    role: header.indexOf('role'),
    employeeCode: header.indexOf('employee_code'),
    bdNumber: header.indexOf('bd_number'),
  }

  if (idx.email === -1 || idx.employeeCode === -1) {
    throw new Error('CSV must have at least email and employee_code columns')
  }

  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const email = (cols[idx.email] ?? '').trim().toLowerCase()
    if (!email) continue

    const employeeCode = (cols[idx.employeeCode] ?? '').trim()
    const empId = parseInt(employeeCode, 10)
    if (!employeeCode || isNaN(empId)) {
      console.warn(`Skipping row ${i + 1}: invalid employee_code "${employeeCode}"`)
      continue
    }

    const bdRaw = idx.bdNumber >= 0 ? (cols[idx.bdNumber] ?? '').trim() : ''
    const bdNumber = bdRaw ? parseInt(bdRaw, 10) : null

    rows.push({
      email,
      name: idx.name >= 0 ? (cols[idx.name] ?? '').trim() || email : email,
      role: idx.role >= 0 ? (cols[idx.role] ?? '').trim() : 'USER',
      employeeCode,
      bdNumber: bdNumber !== null && !isNaN(bdNumber) ? bdNumber : null,
      empId,
    })
  }

  return rows
}

async function resetUsersAndEmployees(placeholderId: string) {
  const client = await pool.connect()
  try {
    await client.query('SET session_replication_role = replica')
    await client.query('DELETE FROM "MDWatchlistEmployee"')
    await client.query('DELETE FROM "MDTaskTeamMember"')
    await client.query('DELETE FROM "TaskDueDateApproval"')
    await client.query('DELETE FROM "Task"')
    await client.query('DELETE FROM "MDTaskTeam"')
    await client.query('DELETE FROM "WorkLog"')
    await client.query('DELETE FROM "Notification"')
    await client.query('DELETE FROM "LeaveRequest"')
    await client.query('DELETE FROM "LeaveBalance"')
    await client.query('DELETE FROM "AttendanceLog"')
    await client.query('DELETE FROM "PayrollComponent"')
    await client.query('DELETE FROM "PayrollRecord"')
    await client.query('DELETE FROM "EmployeeDocument"')
    await client.query('DELETE FROM "Feedback"')
    await client.query('DELETE FROM "MDAppointment"')
    await client.query('DELETE FROM "MentalHealthRequest"')
    await client.query('DELETE FROM "SupportTicket"')
    await client.query('DELETE FROM "IncrementRequest"')
    await client.query('DELETE FROM "IJPApplication"')
    await client.query('DELETE FROM "PreAuthPDF"')
    await client.query('DELETE FROM "PreAuthorization"')
    await client.query('DELETE FROM "PLRecord"')
    await client.query('DELETE FROM "Employee"')
    await client.query('DELETE FROM "User" WHERE id != $1', [placeholderId])
    await client.query('SET session_replication_role = DEFAULT')
  } finally {
    client.release()
  }
}

async function main() {
  const inputPath =
    process.argv[2] || path.join(process.cwd(), 'scripts/db/employee-backup-supabase.csv')
  console.log('Reading', inputPath)

  if (!fs.existsSync(inputPath)) {
    console.error('File not found:', inputPath)
    process.exit(1)
  }

  const rows = parseCsv(fs.readFileSync(inputPath, 'utf-8'))
  if (rows.length === 0) {
    console.error('No valid rows in CSV')
    process.exit(1)
  }

  await prisma.$queryRaw`SELECT 1`

  console.log(`Parsed ${rows.length} employee row(s). Resetting users/employees...`)
  const placeholderHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)
  const placeholder = await prisma.user.upsert({
    where: { email: PLACEHOLDER_EMAIL },
    create: {
      email: PLACEHOLDER_EMAIL,
      passwordHash: placeholderHash,
      name: 'Seed Placeholder',
      role: 'ADMIN',
    },
    update: {},
  })

  await prisma.lead.updateMany({
    data: { bdId: placeholder.id, createdById: placeholder.id, updatedById: placeholder.id },
  })
  await prisma.target.updateMany({ data: { createdById: placeholder.id } })
  await resetUsersAndEmployees(placeholder.id)

  const defaultPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)
  const bdNumberToUserId = new Map<number, string>()
  let mdUserId: string | null = null
  let firstUserId: string | null = null

  for (const row of rows) {
    const user = await prisma.user.create({
      data: {
        email: row.email,
        passwordHash: defaultPasswordHash,
        name: row.name,
        role: mapRole(row.role),
      },
    })

    await prisma.employee.create({
      data: {
        userId: user.id,
        employeeCode: row.employeeCode,
        bdNumber: row.bdNumber,
      },
    })

    if (!firstUserId) firstUserId = user.id
    if (row.empId === MD_EMP_ID) mdUserId = user.id
    if (row.bdNumber !== null && !bdNumberToUserId.has(row.bdNumber)) {
      bdNumberToUserId.set(row.bdNumber, user.id)
    }
  }

  console.log(`Created ${rows.length} user(s) / employee(s). Default password: ${DEFAULT_PASSWORD}`)

  let leadNameUpdates = 0
  for (const row of rows) {
    const user = await prisma.user.findUnique({ where: { email: row.email } })
    if (!user || !row.name) continue
    const result = await prisma.lead.updateMany({
      where: {
        bdeName: { equals: row.name, mode: 'insensitive' },
        bdId: { not: user.id },
      },
      data: { bdId: user.id },
    })
    leadNameUpdates += result.count
  }

  let leadBdNumUpdates = 0
  for (const [bdNum, userId] of bdNumberToUserId) {
    const result = await prisma.lead.updateMany({
      where: { bdeName: String(bdNum), bdId: { not: userId } },
      data: { bdId: userId },
    })
    leadBdNumUpdates += result.count
  }
  console.log(`Lead fix by name: ${leadNameUpdates}, by BD number: ${leadBdNumUpdates}`)

  const fallbackUserId = mdUserId ?? firstUserId
  if (fallbackUserId) {
    await prisma.lead.updateMany({ where: { bdId: placeholder.id }, data: { bdId: fallbackUserId } })
    await prisma.lead.updateMany({
      where: { createdById: placeholder.id },
      data: { createdById: fallbackUserId },
    })
    await prisma.lead.updateMany({
      where: { updatedById: placeholder.id },
      data: { updatedById: fallbackUserId },
    })
    await prisma.target.updateMany({
      where: { createdById: placeholder.id },
      data: { createdById: fallbackUserId },
    })
    // PermissionAssignment.grantedById cascades on user delete — reassign before removing placeholder
    const permReassign = await prisma.permissionAssignment.updateMany({
      where: { grantedById: placeholder.id },
      data: { grantedById: fallbackUserId },
    })
    if (permReassign.count > 0) {
      console.log(`Reassigned grantedById on ${permReassign.count} permission row(s) to MD.`)
    }
  }

  const client = await pool.connect()
  try {
    await client.query('SET session_replication_role = replica')
    await client.query('DELETE FROM "User" WHERE id = $1', [placeholder.id])
    await client.query('SET session_replication_role = DEFAULT')
  } finally {
    client.release()
  }

  console.log('CSV employee seed complete.')
  console.log('Re-seeding role permissions (required after employee reset)...')
  const { spawn } = await import('node:child_process')
  await new Promise<void>((resolve, reject) => {
    const child = spawn('bun', ['run', 'scripts/seed-role-permissions.ts'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
      cwd: process.cwd(),
    })
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`seed-role-permissions exited with ${code}`))
    )
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
