import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { SubjectType, PermissionLevel } from '../generated/prisma/client'

// Predefined allowed sections/pages for each role
const roleAllowedSections: Record<string, string[]> = {
  MD: [
    'main.home', 'main.md_home', 'main.tasks', 'main.calendar', 'main.meets',
    'main.dashboard', 'main.finance_dashboard', 'main.md_hr_dashboard', 'main.md_attendance',
    'main.md_leave_balances', 'main.master_data', 'main.dept_targets', 'main.chat',
    'main.md_messages', 'main.md_appointments', 'main.company_pnl', 'main.targeted_pnl',
    'main.md_pnl', 'main.it_pnl', 'main.loan_demat_revenue', 'main.it_permissions',
    'main.compliance', 'main.md_compliance', 'main.md_outstanding',
    'hrm.attendance_normalizations', 'hrm.people_org', 'hrm.compensation_docs', 'hrm.engagement', 'hrm.recruitment',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval',
    'sales.sales_dashboard', 'sales.dm_dashboard', 'sales.case_tracker', 'sales.pending_surgery', 'sales.targets', 'sales.sales_pnl', 'sales.campaign_cpl',
    'insurance_pl.insurance', 'insurance_pl.cash_cases', 'insurance_pl.pl_ledger', 'insurance_pl.pl_surgery', 'insurance_pl.pl_outstanding', 'insurance_pl.doctor_list', 'insurance_pl.hospital_list',
    'finance.fin_payroll', 'finance.fin_ledger', 'finance.fin_new_ledger_entry', 'finance.fin_sales', 'finance.fin_parties', 'finance.fin_heads', 'finance.fin_projects', 'finance.fin_payment_modes', 'finance.fin_inventory', 'finance.fin_approvals', 'finance.fin_team_approvals', 'finance.md_team_approvals', 'finance.fin_reports',
    'actions'
  ],
  ADMIN: [
    'main', 'hrm', 'myhrms', 'sales', 'insurance_pl', 'finance', 'actions' // ADMIN gets all
  ],
  TESTER: [
    'main', 'hrm', 'myhrms', 'sales', 'insurance_pl', 'finance', 'actions' // TESTER gets all
  ],
  EXECUTIVE_ASSISTANT: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.dashboard',
    'main.md_hr_dashboard', 'hrm.attendance_normalizations', 'hrm.people_org',
    'hrm.compensation_docs', 'hrm.engagement', 'hrm.recruitment',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval',
    'sales.sales_dashboard', 'sales.case_tracker'
  ],
  IT_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.it_permissions', 'main.it_pnl',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval'
  ],
  HR_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.md_hr_dashboard', 'main.md_attendance', 'main.md_leave_balances',
    'hrm.attendance_normalizations', 'hrm.people_org', 'hrm.compensation_docs', 'hrm.engagement', 'hrm.recruitment',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval'
  ],
  FINANCE_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.finance_dashboard', 'main.company_pnl', 'main.targeted_pnl', 'main.md_pnl', 'main.loan_demat_revenue',
    'finance.fin_payroll', 'finance.fin_ledger', 'finance.fin_new_ledger_entry', 'finance.fin_sales', 'finance.fin_parties', 'finance.fin_heads', 'finance.fin_projects', 'finance.fin_payment_modes', 'finance.fin_inventory', 'finance.fin_approvals', 'finance.fin_team_approvals', 'finance.md_team_approvals', 'finance.fin_reports',
    'insurance_pl.pl_ledger',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval'
  ],
  SALES_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.dashboard',
    'sales.sales_dashboard', 'sales.case_tracker', 'sales.pending_surgery', 'sales.targets', 'sales.sales_pnl', 'sales.campaign_cpl',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval'
  ],
  INSURANCE_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.dashboard',
    'insurance_pl.insurance', 'insurance_pl.doctor_list', 'insurance_pl.hospital_list',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval'
  ],
  PL_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.dashboard', 'sales.case_tracker', 'main.master_data', 'main.chat',
    'insurance_pl.pl_surgery', 'insurance_pl.pl_ledger', 'insurance_pl.pl_outstanding', 'insurance_pl.cash_cases', 'insurance_pl.doctor_list', 'insurance_pl.hospital_list',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval',
    'sales.sales_pnl'
  ],
  OUTSTANDING_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.dashboard', 'main.md_outstanding',
    'insurance_pl.pl_outstanding',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval'
  ],
  DIGITAL_MARKETING_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.dashboard',
    'sales.dm_dashboard', 'sales.campaign_cpl',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval'
  ],
  CATEGORY_MANAGER: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets',
    'sales.sales_dashboard', 'sales.case_tracker',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval'
  ],
  ASSISTANT_CATEGORY_MANAGER: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets',
    'sales.sales_dashboard', 'sales.case_tracker',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval'
  ],
  TEAM_LEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.dashboard',
    'sales.case_tracker',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval'
  ],
  BD: [
    'main.home', 'main.tasks', 'main.calendar',
    'sales.case_tracker',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval'
  ],
  COMPLIANCE_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.dashboard', 'main.compliance',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval'
  ],
  LOAN_DEMAT_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.loan_demat_revenue',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval'
  ],
  USER: [
    'main.home', 'main.tasks', 'main.calendar',
    'myhrms.my_core_hr', 'myhrms.my_financial', 'myhrms.my_support_services', 'myhrms.my_team', 'myhrms.ask_md_approval'
  ]
}

async function main() {
  console.log('Fetching granter account...')
  const granter =
    (await prisma.user.findFirst({
      where: { role: 'MD' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })) ??
    (await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    }))

  if (!granter) {
    console.error(
      'No MD or ADMIN user found. Seed employees (or prisma/seed.ts) before running role permissions.'
    )
    process.exit(1)
  }
  const grantedById = granter.id

  console.log('Fetching active system resources...')
  const allResources = await prisma.resource.findMany({
    where: { isActive: true }
  })
  console.log(`Loaded ${allResources.length} resources.`)

  console.log('Purging legacy role assignments...')
  await prisma.permissionAssignment.deleteMany({
    where: { subjectType: SubjectType.ROLE }
  })

  console.log('Seeding role assignments...')
  let seedCount = 0

  for (const [role, allowedKeys] of Object.entries(roleAllowedSections)) {
    const allowedResources = allResources.filter((res) => {
      return allowedKeys.some((allowedKey) =>
        res.key === allowedKey ||
        res.key.startsWith(allowedKey + '.') ||
        allowedKey.startsWith(res.key + '.')
      )
    })

    const canGrant = role === 'ADMIN' || role === 'MD'

    console.log(`Setting up ${allowedResources.length} assignments for role: ${role}...`)

    for (const res of allowedResources) {
      await prisma.permissionAssignment.create({
        data: {
          subjectType: SubjectType.ROLE,
          role,
          resourceId: res.id,
          permissionLevel: PermissionLevel.FULL_ACCESS,
          canGrant,
          grantedById
        }
      })
      seedCount++
    }
  }

  console.log(`Successfully seeded ${seedCount} role-level permissions.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
