import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { SubjectType, PermissionLevel } from '../generated/prisma/client'

/** Available to every role except ACCESS_MATRIX (mediend AI / training chat). */
const UNIVERSAL_SECTIONS = ['main.training'] as const

const MYHRMS = [
  'myhrms.my_core_hr',
  'myhrms.my_financial',
  'myhrms.my_support_services',
  'myhrms.my_team',
] as const

const HRM_CORE = [
  'hrm.attendance_normalizations',
  'hrm.people_org',
  'hrm.compensation_docs',
  'hrm.engagement',
] as const

const FINANCE_SECTION = [
  'finance.fin_payroll',
  'finance.fin_ledger',
  'finance.fin_new_ledger_entry',
  'finance.fin_sales',
  'finance.fin_parties',
  'finance.fin_heads',
  'finance.fin_projects',
  'finance.fin_payment_modes',
  'finance.fin_inventory',
  'finance.fin_approvals',
  'finance.fin_team_approvals',
  'finance.fin_reports',
  'finance.fin_invoice_requests',
  'finance.fin_doctor_payoff',
] as const

// Predefined allowed sections/pages for each role
const roleAllowedSections: Record<string, string[]> = {
  MD: [
    'main.home', 'main.md_home', 'main.tasks', 'main.calendar', 'main.meets',
    'main.dashboard', 'main.finance_dashboard', 'main.md_hr_dashboard', 'main.md_attendance',
    'main.md_leave_balances', 'main.master_data', 'main.dept_targets', 'main.chat',
    'main.md_messages', 'main.md_appointments', 'main.company_pnl', 'main.targeted_pnl',
    'main.md_pnl', 'main.it_pnl', 'main.loan_demat_revenue', 'main.it_permissions',
    'main.compliance', 'main.md_compliance', 'main.md_outstanding', 'main.incentive', 'main.cumulative_report',
    'hrm.hr_dashboard', ...HRM_CORE, 'hrm.onboarding', 'hrm.recruitment',
    ...MYHRMS, 'myhrms.ask_md_approval',
    'sales.sales_dashboard', 'sales.md_sales_dashboard', 'sales.dm_dashboard', 'sales.case_tracker',
    'sales.pending_surgery', 'sales.targets', 'sales.sales_head_targets', 'sales.sales_pnl',
    'sales.campaign_cpl', 'sales.sales_pipeline', 'sales.team_lead_pipeline', 'sales.blueprint_dashboard',
    'sales.opd_monitoring',
    'insurance_pl.insurance', 'insurance_pl.cash_cases', 'insurance_pl.pl_ledger', 'insurance_pl.pl_surgery',
    'insurance_pl.pl_outstanding', 'insurance_pl.doctor_list', 'insurance_pl.hospital_list',
    ...FINANCE_SECTION, 'finance.md_team_approvals', 'finance.fin_sales_team_cost', 'finance.master_seating_cost',
    'actions', 'crm',
  ],
  ADMIN: [
    'main', 'hrm', 'myhrms', 'sales', 'insurance_pl', 'finance', 'actions', 'crm',
  ],
  TESTER: [
    'main', 'hrm', 'myhrms', 'sales', 'insurance_pl', 'finance', 'actions', 'crm',
  ],

  /** Project Head — no finance module */
  EXECUTIVE_ASSISTANT: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets',
    'main.master_data', 'main.doctor_admin', 'main.dept_targets',
    'main.chat', 'main.cumulative_report',
    'sales.blueprint_dashboard',
    'insurance_pl.pl_outstanding',
    ...HRM_CORE,
    'finance.md_team_approvals',
    'hrm.recruitment',
    ...MYHRMS, 'myhrms.ask_md_approval',
    'main.incentive', 'sales.dm_dashboard', 'sales.campaign_cpl', 'sales.ea_pipeline',
    'sales.case_tracker', 'sales.opd_monitoring', 'sales.pending_surgery',
    'sales.sales_head_targets', 'sales.sales_pnl',
    'insurance_pl.insurance', 'insurance_pl.cash_cases', 'insurance_pl.pl_ledger',
    'insurance_pl.pl_surgery', 'insurance_pl.doctor_list', 'insurance_pl.hospital_list',
  ],

  IT_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.dept_targets',
    'hrm.people_org', 'hrm.onboarding', 'hrm.compensation_docs', 'hrm.engagement',
    'main.it_permissions', 'main.it_pnl', 'sales.campaign_cpl',
    ...MYHRMS, 'myhrms.ask_md_approval',
  ],

  HR_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets',
    'main.dept_targets', 'hrm.hr_dashboard', 'hrm.recruitment', 'myhrms.ask_md_approval',
    ...HRM_CORE,
  ],

  FINANCE_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets',
    'main.dashboard', 'main.finance_dashboard',
    'insurance_pl.pl_ledger', 'insurance_pl.pl_outstanding',
    'insurance_pl.doctor_list', 'insurance_pl.hospital_list',
    'hrm.people_org', 'hrm.onboarding', 'hrm.compensation_docs', 'hrm.engagement',
    'finance.fin_team_approvals', 'myhrms.ask_md_approval',
    'finance.fin_sales_team_cost', 'finance.master_seating_cost',
    'main.company_pnl', 'main.targeted_pnl', 'main.md_pnl', 'main.it_pnl', 'main.loan_demat_revenue',
    ...MYHRMS,
    ...FINANCE_SECTION,
  ],

  SALES_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.ipd_calendar', 'main.chat',
    'sales.sales_dashboard', 'sales.case_tracker', 'sales.pending_surgery', 'sales.targets',
    'sales.sales_head_targets', 'sales.sales_pnl', 'sales.campaign_cpl', 'sales.sales_pipeline',
    'sales.team_lead_pipeline', 'sales.blueprint_dashboard', 'sales.opd_monitoring',
    'insurance_pl.pl_surgery', 'insurance_pl.pl_ledger', 'insurance_pl.pl_outstanding',
    'insurance_pl.doctor_list', 'insurance_pl.hospital_list',
    ...MYHRMS, 'myhrms.ask_md_approval', 'main.incentive',
    'crm.incoming_leads', 'crm.churn_rules',
  ],

  INSURANCE_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets',
    'insurance_pl.insurance', 'insurance_pl.cash_cases', 'main.chat',
  ],

  PL_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.dashboard',
    'sales.case_tracker', 'main.master_data', 'main.chat',
    'insurance_pl.pl_surgery', 'insurance_pl.pl_ledger', 'insurance_pl.pl_outstanding',
    'insurance_pl.doctor_list', 'insurance_pl.hospital_list',
    ...MYHRMS, 'myhrms.ask_md_approval',
    'sales.sales_pnl',
  ],

  OUTSTANDING_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.dashboard', 'main.md_outstanding',
    'insurance_pl.pl_outstanding',
    ...MYHRMS, 'myhrms.ask_md_approval',
  ],

  DIGITAL_MARKETING_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.dashboard', 'main.chat',
    'main.dept_targets',
    'sales.dm_dashboard', 'sales.campaign_cpl', 'sales.sales_pnl', 'sales.sales_dashboard',
    'insurance_pl.pl_surgery', 'insurance_pl.pl_ledger', 'insurance_pl.pl_outstanding',
    'insurance_pl.cash_cases', 'insurance_pl.doctor_list', 'insurance_pl.hospital_list',
    ...MYHRMS, 'myhrms.ask_md_approval',
  ],

  CATEGORY_MANAGER: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.dashboard', 'main.chat',
    'main.ipd_calendar',
    'sales.sales_dashboard', 'sales.case_tracker', 'sales.campaign_cpl', 'sales.pending_surgery',
    'sales.targets', 'sales.team_lead_pipeline', 'sales.opd_monitoring',
    ...MYHRMS, 'myhrms.ask_md_approval',
    'crm.incoming_leads',
  ],

  ASSISTANT_CATEGORY_MANAGER: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.ipd_calendar',
    'sales.sales_dashboard', 'sales.case_tracker', 'sales.opd_monitoring', 'sales.pending_surgery',
    'sales.targets', 'sales.team_lead_targets', 'sales.team_lead_pipeline', 'main.chat',
    'finance.fin_team_approvals', 'myhrms.ask_md_approval',
    ...MYHRMS,
  ],

  TEAM_LEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.ipd_calendar',
    'sales.sales_dashboard', 'sales.case_tracker', 'sales.opd_monitoring', 'sales.pending_surgery',
    'sales.targets', 'sales.team_lead_targets', 'sales.team_lead_pipeline', 'main.chat',
    'finance.fin_team_approvals', 'myhrms.ask_md_approval',
    ...MYHRMS,
  ],

  BD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.ipd_calendar',
    'sales.sales_pipeline', 'sales.case_tracker', 'sales.opd_monitoring', 'main.chat',
    'myhrms.ask_md_approval',
    ...MYHRMS,
  ],

  COMPLIANCE_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets',
    'main.chat', 'main.compliance', 'main.cumulative_report',
  ],

  LOAN_DEMAT_HEAD: [
    'main.home', 'main.tasks', 'main.calendar', 'main.meets', 'main.loan_demat_revenue',
    ...MYHRMS, 'myhrms.ask_md_approval',
  ],

  USER: [
    'main.home', 'main.tasks', 'main.calendar',
    ...MYHRMS, 'myhrms.ask_md_approval',
  ],

  ACCESS_MATRIX: [
    'main.it_permissions',
  ],

  SUPER_ADMIN: [
    'main.home', 'main.tasks', 'main.calendar', 'crm',
  ],

  CRM_ADMIN: [
    'main.home', 'main.tasks', 'main.calendar', 'crm',
  ],
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
    where: { isActive: true },
  })
  console.log(`Loaded ${allResources.length} resources.`)

  console.log('Purging legacy role assignments...')
  await prisma.permissionAssignment.deleteMany({
    where: { subjectType: SubjectType.ROLE },
  })

  console.log('Seeding role assignments...')
  console.log(`Universal sections (all roles except ACCESS_MATRIX): ${UNIVERSAL_SECTIONS.join(', ')}`)
  let seedCount = 0

  for (const [role, allowedKeys] of Object.entries(roleAllowedSections)) {
    const keys =
      role === 'ACCESS_MATRIX'
        ? allowedKeys
        : [...new Set([...allowedKeys, ...UNIVERSAL_SECTIONS])]

    const allowedResources = allResources.filter((res) => {
      return keys.some(
        (allowedKey) =>
          res.key === allowedKey ||
          res.key.startsWith(allowedKey + '.') ||
          allowedKey.startsWith(res.key + '.')
      )
    })

    const canGrant = role === 'ADMIN' || role === 'MD'

    console.log(`Setting up ${allowedResources.length} assignments for role: ${role}...`)

    const batchSize = 100
    for (let i = 0; i < allowedResources.length; i += batchSize) {
      const chunk = allowedResources.slice(i, i + batchSize)
      await prisma.permissionAssignment.createMany({
        data: chunk.map((res) => ({
          subjectType: SubjectType.ROLE,
          role,
          resourceId: res.id,
          permissionLevel: PermissionLevel.FULL_ACCESS,
          canGrant,
          grantedById,
        })),
      })
      seedCount += chunk.length
    }
  }

  console.log(`Successfully seeded ${seedCount} role-level permissions.`)

  const trainingResource = await prisma.resource.findUnique({
    where: { key: 'main.training' },
    select: { id: true, isActive: true },
  })
  if (!trainingResource) {
    console.warn('WARNING: Resource main.training is missing. Run scripts/seed-rbac.ts first.')
  } else {
    const trainingRoleGrants = await prisma.permissionAssignment.count({
      where: {
        subjectType: SubjectType.ROLE,
        resourceId: trainingResource.id,
        permissionLevel: { not: PermissionLevel.NONE },
      },
    })
    console.log(
      `main.training: resource=${trainingResource.isActive ? 'active' : 'inactive'}, role grants=${trainingRoleGrants}`
    )
    if (trainingRoleGrants === 0) {
      console.warn('WARNING: No role has main.training — /training will show Access Denied for everyone.')
    }
  }

  // Sanity: EA must not have finance.* grants
  const eaFinanceCount = await prisma.permissionAssignment.count({
    where: {
      subjectType: SubjectType.ROLE,
      role: 'EXECUTIVE_ASSISTANT',
      resource: { key: { startsWith: 'finance.' } },
      permissionLevel: { not: PermissionLevel.NONE },
    },
  })
  // md_team_approvals is under finance module key — allow that one for EA Team Approvals
  const eaFinanceNonMd = await prisma.permissionAssignment.count({
    where: {
      subjectType: SubjectType.ROLE,
      role: 'EXECUTIVE_ASSISTANT',
      resource: {
        key: { startsWith: 'finance.' },
        NOT: { key: 'finance.md_team_approvals' },
      },
      permissionLevel: { not: PermissionLevel.NONE },
    },
  })
  console.log(
    `EXECUTIVE_ASSISTANT finance grants: total=${eaFinanceCount}, excluding md_team_approvals=${eaFinanceNonMd}`
  )
  if (eaFinanceNonMd > 0) {
    console.warn('WARNING: EXECUTIVE_ASSISTANT still has non-md finance permissions.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
