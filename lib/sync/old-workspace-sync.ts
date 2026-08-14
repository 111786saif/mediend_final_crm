import { PrismaClient, type Prisma, UserRole } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

export type WorkspacePrisma = PrismaClient

export function createSourcePrisma(): WorkspacePrisma {
  const url = process.env.SOURCE_DATABASE_URL
  if (!url) {
    throw new Error('SOURCE_DATABASE_URL is required (old workspace Postgres connection string)')
  }
  const poolMax = Number(process.env.SOURCE_DB_POOL_MAX ?? 10)
  const adapter = new PrismaPg({
    connectionString: url,
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 60_000,
    allowExitOnIdle: true,
  })
  return new PrismaClient({ adapter })
}

/** Tracks which source tables/models exist; avoids Prisma error spam on old schema. */
export class SourceSchemaGuard {
  private blocked = new Set<string>()

  private constructor(private tables: Set<string>) {}

  private static readonly OPTIONAL_MODELS: Array<[string, string]> = [
    ['leadRemark', 'LeadRemark'],
    ['leadRemarkEntry', 'LeadRemarkEntry'],
    ['callNote', 'CallNote'],
    ['leadStageEvent', 'LeadStageEvent'],
    ['caseStageHistory', 'CaseStageHistory'],
    ['workflowResetLog', 'WorkflowResetLog'],
    ['caseChatMessage', 'CaseChatMessage'],
    ['chatReadReceipt', 'ChatReadReceipt'],
    ['kypSubmission', 'KYPSubmission'],
    ['insuranceCase', 'InsuranceCase'],
    ['insuranceInitiateForm', 'InsuranceInitiateForm'],
    ['admissionRecord', 'AdmissionRecord'],
    ['dischargeSheet', 'DischargeSheet'],
    ['pLRecord', 'PLRecord'],
    ['outstandingCase', 'OutstandingCase'],
    ['complianceCall', 'ComplianceCall'],
    ['leadOpdPrescriptionImage', 'LeadOpdPrescriptionImage'],
    ['leadOpdAppointment', 'LeadOpdAppointment'],
    ['paymentInstallment', 'PaymentInstallment'],
    ['invoiceRequest', 'InvoiceRequest'],
    ['doctorPayoffRequest', 'DoctorPayoffRequest'],
    ['leadQrCallAuditLog', 'LeadQrCallAuditLog'],
    ['leadQrPublicLink', 'LeadQrPublicLink'],
    ['crmAssignmentPreviewLog', 'CrmAssignmentPreviewLog'],
  ]

  static async load(source: WorkspacePrisma): Promise<SourceSchemaGuard> {
    const rows = await source.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `
    const guard = new SourceSchemaGuard(new Set(rows.map((r) => r.table_name)))

    for (const [key, table] of SourceSchemaGuard.OPTIONAL_MODELS) {
      if (!guard.tables.has(table)) guard.blocked.add(key)
    }

    // One-time probes for tables that exist but have column drift vs current Prisma schema.
    await guard.probe(source, [
      [
        'kypSubmission',
        'KYPSubmission',
        () =>
          source.kYPSubmission.findFirst({
            include: {
              preAuthData: {
                include: {
                  suggestedHospitals: { take: 1 },
                  queries: { take: 1 },
                  pdfVersions: { take: 1 },
                },
              },
            },
          }),
      ],
      [
        'admissionRecord',
        'AdmissionRecord',
        () =>
          source.admissionRecord.findFirst({
            include: {
              implantUsages: { take: 1 },
              prescriptionImages: { take: 1 },
            },
          }),
      ],
      ['complianceCall', 'ComplianceCall', () => source.complianceCall.findFirst()],
      ['paymentInstallment', 'PaymentInstallment', () => source.paymentInstallment.findFirst()],
    ])

    return guard
  }

  logSummary(): void {
    const skipped = [...this.blocked].sort()
    if (skipped.length === 0) return
    console.log(`⏭ Source schema: skipping ${skipped.length} model(s) — ${skipped.join(', ')}`)
  }

  private async probe(
    source: WorkspacePrisma,
    probes: Array<[string, string, () => Promise<unknown>]>
  ): Promise<void> {
    for (const [key, table, fn] of probes) {
      if (!this.tables.has(table)) {
        this.blocked.add(key)
        continue
      }
      try {
        await fn()
      } catch (e) {
        if (isMissingSchemaError(e)) this.blocked.add(key)
      }
    }
  }

  async optional<T>(key: string, table: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    if (this.blocked.has(key) || !this.tables.has(table)) {
      if (!this.tables.has(table)) this.blocked.add(key)
      return fallback
    }
    try {
      return await fn()
    } catch (e) {
      if (isMissingSchemaError(e)) {
        this.blocked.add(key)
        return fallback
      }
      throw e
    }
  }
}

/** Parse YYYY-MM-DD as IST midnight → UTC Date. */
export function parseIstDate(s: string): Date {
  const d = new Date(`${s}T00:00:00+05:30`)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${s} (expected YYYY-MM-DD)`)
  }
  return d
}

export function parseCliDates(argv: string[]): { from: Date; toExclusive: Date } {
  const fromIdx = argv.indexOf('--from')
  const toIdx = argv.indexOf('--to')
  const fromStr = fromIdx >= 0 ? argv[fromIdx + 1] : '2026-08-08'
  const toStr = toIdx >= 0 ? argv[toIdx + 1] : '2026-08-13'
  if (!fromStr || !toStr) throw new Error('--from and --to require YYYY-MM-DD values')

  const from = parseIstDate(fromStr)
  const toEnd = parseIstDate(toStr)
  const toExclusive = new Date(toEnd.getTime() + 24 * 60 * 60 * 1000)
  return { from, toExclusive }
}

export function parseLeadRefFilter(argv: string[]): string[] | null {
  const idx = argv.indexOf('--lead-ref')
  if (idx === -1) return null
  const raw = argv[idx + 1]
  if (!raw) throw new Error('--lead-ref requires a comma-separated list')
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

/** Map source User.id → target User.id by email; fallback to first admin-like user. */
export async function buildUserIdMap(
  source: WorkspacePrisma,
  target: WorkspacePrisma
): Promise<{ map: Map<string, string>; fallbackUserId: string }> {
  const fallbackRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.MD,
    UserRole.CRM_ADMIN,
  ]

  const [sourceUsers, targetUsers] = await Promise.all([
    source.user.findMany({ select: { id: true, email: true } }),
    target.user.findMany({ select: { id: true, email: true } }),
  ])

  let fallbackUserId: string | null = null
  for (const role of fallbackRoles) {
    const user = await target.user.findFirst({ where: { role }, select: { id: true } })
    if (user) {
      fallbackUserId = user.id
      break
    }
  }
  if (!fallbackUserId) {
    const anyUser = await target.user.findFirst({ select: { id: true } })
    if (!anyUser) throw new Error('No users found on target database — cannot map user IDs')
    fallbackUserId = anyUser.id
  }

  const targetByEmail = new Map(targetUsers.map((u) => [u.email.toLowerCase(), u.id]))
  const map = new Map<string, string>()

  for (const u of sourceUsers) {
    const targetId = targetByEmail.get(u.email.toLowerCase())
    if (targetId) map.set(u.id, targetId)
  }

  return { map, fallbackUserId }
}

export function remapUserId(
  userId: string | null | undefined,
  userMap: Map<string, string>,
  fallbackUserId: string
): string | null {
  if (!userId) return null
  return userMap.get(userId) ?? fallbackUserId
}

function isMissingSchemaError(e: unknown): boolean {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = String((e as { code: string }).code)
    if (code === 'P2010' || code === 'P2021' || code === 'P2022') return true
  }
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = String((e as { message: string }).message)
    if (/does not exist in the current database/i.test(msg)) return true
    if (/relation .* does not exist/i.test(msg)) return true
  }
  return false
}

/** Run a source DB read; return fallback if table/column missing on old schema. */
async function sourceOptional<T>(
  schema: SourceSchemaGuard,
  key: string,
  table: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  return schema.optional(key, table, fn, fallback)
}

const leadColumnCache = new WeakMap<WorkspacePrisma, Set<string>>()

async function getLeadColumns(db: WorkspacePrisma): Promise<Set<string>> {
  const cached = leadColumnCache.get(db)
  if (cached) return cached

  const rows = await db.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Lead'
  `
  const cols = new Set(rows.map((r) => r.column_name))
  leadColumnCache.set(db, cols)
  return cols
}

/** Fetch lead row from old DB via raw SQL (avoids Prisma selecting columns missing on old schema). */
async function fetchSourceLeadRow(
  source: WorkspacePrisma,
  leadRef: string
): Promise<{ row: Record<string, unknown>; id: string } | null> {
  const rows = await source.$queryRaw<Array<Record<string, unknown>>>`
    SELECT * FROM "Lead" WHERE "leadRef" = ${leadRef} LIMIT 1
  `
  const row = rows[0]
  if (!row || typeof row.id !== 'string') return null
  return { row, id: row.id }
}

async function buildLeadFieldsFromSourceRow(
  source: WorkspacePrisma,
  target: WorkspacePrisma,
  row: Record<string, unknown>,
  userMap: Map<string, string>,
  fallbackUserId: string,
  treatmentMasterIds?: Set<string>
): Promise<Record<string, unknown>> {
  const [sourceCols, targetCols] = await Promise.all([getLeadColumns(source), getLeadColumns(target)])
  const skip = new Set(['id', 'leadRef'])
  /** Old DB may store these as integer; new schema expects string. */
  const stringFields = new Set([
    'subStatus',
    'modeOfPayment',
    'remarksId',
    'bdeName',
    'waFormat',
    'refId',
    'adId',
    'campaignId',
    'formId',
    'opdSurgeryRemarkCode',
    'opdReasonNoSurgeryCode',
    'opdFollowUpReasonCode',
  ])
  const data: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(row)) {
    if (skip.has(key)) continue
    if (!sourceCols.has(key) || !targetCols.has(key)) continue
    if (value === null || value === undefined) {
      data[key] = value
      continue
    }
    if (stringFields.has(key) && (typeof value === 'number' || typeof value === 'bigint')) {
      data[key] = String(value)
      continue
    }
    data[key] = value
  }

  if (typeof data.treatmentMasterId === 'string') {
    if (treatmentMasterIds) {
      if (!treatmentMasterIds.has(data.treatmentMasterId)) data.treatmentMasterId = null
    } else {
      const exists = await target.treatmentMaster.findUnique({
        where: { id: data.treatmentMasterId },
        select: { id: true },
      })
      if (!exists) data.treatmentMasterId = null
    }
  }

  data.bdId = remapUserId(String(row.bdId ?? ''), userMap, fallbackUserId)
  data.createdById = remapUserId(String(row.createdById ?? ''), userMap, fallbackUserId)
  data.updatedById = remapUserId(String(row.updatedById ?? ''), userMap, fallbackUserId)

  return data
}

async function buildLeadUpdateFromSourceRow(
  source: WorkspacePrisma,
  target: WorkspacePrisma,
  row: Record<string, unknown>,
  userMap: Map<string, string>,
  fallbackUserId: string,
  treatmentMasterIds?: Set<string>
): Promise<Prisma.LeadUpdateInput> {
  return (await buildLeadFieldsFromSourceRow(
    source,
    target,
    row,
    userMap,
    fallbackUserId,
    treatmentMasterIds
  )) as Prisma.LeadUpdateInput
}

async function buildLeadCreateFromSourceRow(
  source: WorkspacePrisma,
  target: WorkspacePrisma,
  row: Record<string, unknown>,
  leadRef: string,
  leadId: string,
  userMap: Map<string, string>,
  fallbackUserId: string,
  treatmentMasterIds?: Set<string>
): Promise<Prisma.LeadCreateInput> {
  const data = await buildLeadFieldsFromSourceRow(
    source,
    target,
    row,
    userMap,
    fallbackUserId,
    treatmentMasterIds
  )
  return {
    id: leadId,
    leadRef,
    ...data,
  } as Prisma.LeadCreateInput
}

/** Lead refs with activity in [from, toExclusive) on source DB.
 *  Primary signal: Lead.updatedDate (last time the lead row changed).
 *  Also checks child tables that exist on the old schema (LeadRemark, stage history, KYP, compliance). */
export async function findLeadRefsInRange(
  source: WorkspacePrisma,
  from: Date,
  toExclusive: Date,
  leadRefFilter: string[] | null,
  schema: SourceSchemaGuard
): Promise<string[]> {
  if (leadRefFilter?.length) return [...new Set(leadRefFilter)]

  const dateRange = { gte: from, lt: toExclusive }
  const leadRefSet = new Set<string>()

  const add = (refs: string[]) => refs.forEach((r) => leadRefSet.add(r))

  // Main activity column — updated whenever lead status/stage/fields change
  const byUpdated = await source.lead.findMany({
    where: { updatedDate: dateRange },
    select: { leadRef: true },
  })
  add(byUpdated.map((l) => l.leadRef))

  // Legacy MySQL-synced remarks (exists on old workspace)
  const remarks = await sourceOptional(
    schema,
    'leadRemark',
    'LeadRemark',
    () =>
      source.leadRemark.findMany({
        where: { updateDate: dateRange },
        select: { leadRef: true },
        distinct: ['leadRef'],
      }),
    []
  )
  add(remarks.map((r) => r.leadRef))

  // Workflow stage changes
  const stageHistory = await sourceOptional(
    schema,
    'caseStageHistory',
    'CaseStageHistory',
    () =>
      source.caseStageHistory.findMany({
        where: { changedAt: dateRange },
        select: { lead: { select: { leadRef: true } } },
      }),
    []
  )
  add(stageHistory.map((h) => h.lead.leadRef))

  const pipelineEvents = await sourceOptional(
    schema,
    'leadStageEvent',
    'LeadStageEvent',
    () =>
      source.leadStageEvent.findMany({
        where: { changedAt: dateRange },
        select: { lead: { select: { leadRef: true } } },
      }),
    []
  )
  add(pipelineEvents.map((e) => e.lead.leadRef))

  // Insurance / compliance activity
  const kypUpdates = await sourceOptional(
    schema,
    'kypSubmission',
    'KYPSubmission',
    () =>
      source.kYPSubmission.findMany({
        where: { OR: [{ updatedAt: dateRange }, { submittedAt: dateRange }] },
        select: { lead: { select: { leadRef: true } } },
      }),
    []
  )
  add(kypUpdates.map((k) => k.lead.leadRef))

  const complianceUpdates = await sourceOptional(
    schema,
    'complianceCall',
    'ComplianceCall',
    () =>
      source.complianceCall.findMany({
        where: { OR: [{ updatedAt: dateRange }, { createdAt: dateRange }] },
        select: { lead: { select: { leadRef: true } } },
      }),
    []
  )
  add(complianceUpdates.map((c) => c.lead.leadRef))

  return [...leadRefSet].sort()
}

/** Remove all lead-scoped rows on target before overwrite. */
export async function deleteTargetLeadBundle(tx: Prisma.TransactionClient, targetLeadId: string) {
  const kyp = await tx.kYPSubmission.findUnique({
    where: { leadId: targetLeadId },
    select: { id: true, preAuthData: { select: { id: true } } },
  })

  if (kyp?.preAuthData) {
    await tx.preAuthPDF.deleteMany({ where: { preAuthorizationId: kyp.preAuthData.id } })
    await tx.insuranceQuery.deleteMany({ where: { preAuthorizationId: kyp.preAuthData.id } })
    await tx.hospitalSuggestion.deleteMany({ where: { preAuthId: kyp.preAuthData.id } })
    await tx.preAuthorization.deleteMany({ where: { id: kyp.preAuthData.id } })
  }

  await tx.dischargeSheet.deleteMany({ where: { leadId: targetLeadId } })
  await tx.kYPSubmission.deleteMany({ where: { leadId: targetLeadId } })

  const admission = await tx.admissionRecord.findUnique({
    where: { leadId: targetLeadId },
    select: { id: true },
  })
  if (admission) {
    await tx.admissionRecordImplantUsage.deleteMany({ where: { admissionRecordId: admission.id } })
    await tx.admissionRecordPrescriptionImage.deleteMany({ where: { admissionRecordId: admission.id } })
    await tx.admissionRecord.deleteMany({ where: { id: admission.id } })
  }

  const opdApps = await tx.leadOpdAppointment.findMany({
    where: { leadId: targetLeadId },
    select: { id: true },
  })
  for (const app of opdApps) {
    await tx.leadOpdAppointmentPrescriptionImage.deleteMany({ where: { opdAppointmentId: app.id } })
  }
  await tx.leadOpdAppointment.deleteMany({ where: { leadId: targetLeadId } })

  const invoices = await tx.invoiceRequest.findMany({
    where: { leadId: targetLeadId },
    select: { id: true },
  })
  for (const inv of invoices) {
    await tx.invoiceRequestActivity.deleteMany({ where: { requestId: inv.id } })
  }
  await tx.invoiceRequest.deleteMany({ where: { leadId: targetLeadId } })

  const payoffs = await tx.doctorPayoffRequest.findMany({
    where: { leadId: targetLeadId },
    select: { id: true },
  })
  for (const p of payoffs) {
    await tx.doctorPayoffRequestActivity.deleteMany({ where: { requestId: p.id } })
  }
  await tx.doctorPayoffRequest.deleteMany({ where: { leadId: targetLeadId } })

  await tx.paymentInstallment.deleteMany({ where: { leadId: targetLeadId } })
  await tx.caseChatMessage.deleteMany({ where: { leadId: targetLeadId } })
  await tx.chatReadReceipt.deleteMany({ where: { leadId: targetLeadId } })
  await tx.complianceCall.deleteMany({ where: { leadId: targetLeadId } })
  await tx.outstandingCase.deleteMany({ where: { leadId: targetLeadId } })
  await tx.pLRecord.deleteMany({ where: { leadId: targetLeadId } })
  await tx.insuranceInitiateForm.deleteMany({ where: { leadId: targetLeadId } })
  await tx.insuranceCase.deleteMany({ where: { leadId: targetLeadId } })
  await tx.workflowResetLog.deleteMany({ where: { leadId: targetLeadId } })
  await tx.caseStageHistory.deleteMany({ where: { leadId: targetLeadId } })
  await tx.leadStageEvent.deleteMany({ where: { leadId: targetLeadId } })
  await tx.leadRemarkEntry.deleteMany({ where: { leadId: targetLeadId } })
  await tx.callNote.deleteMany({ where: { leadId: targetLeadId } })
  await tx.leadOpdPrescriptionImage.deleteMany({ where: { leadId: targetLeadId } })
  await tx.leadQrCallAuditLog.deleteMany({ where: { leadId: targetLeadId } })
  await tx.leadQrPublicLink.deleteMany({ where: { leadId: targetLeadId } })
  await tx.crmAssignmentPreviewLog.deleteMany({ where: { leadId: targetLeadId } })
}

export type CopyLeadBundleOptions = {
  /** Insert leads that exist on old DB but not on target (default: skip them). */
  createMissing?: boolean
  /** Only sync Lead row fields — skip child tables (much faster). */
  leadOnly?: boolean
  treatmentMasterIds?: Set<string>
}

/** Cache valid treatment master IDs once per sync run. */
export async function loadTreatmentMasterIds(target: WorkspacePrisma): Promise<Set<string>> {
  const rows = await target.treatmentMaster.findMany({ select: { id: true } })
  return new Set(rows.map((r) => r.id))
}

/** Read all source-side child rows in parallel (outside target transaction). */
async function fetchSourceLeadBundle(
  source: WorkspacePrisma,
  schema: SourceSchemaGuard,
  leadRef: string,
  sourceLeadId: string
) {
  const [
    remarks,
    remarkEntries,
    callNotes,
    stageEvents,
    caseHistory,
    resetLogs,
    chatMessages,
    readReceipts,
    kyp,
    insuranceCase,
    initiateForm,
    admission,
    discharge,
    pl,
    outstanding,
    compliance,
    opdImages,
    opdApps,
    installments,
    invoices,
    payoffs,
    qrLogs,
    qrLinks,
    previewLogs,
  ] = await Promise.all([
    sourceOptional(schema, 'leadRemark', 'LeadRemark', () => source.leadRemark.findMany({ where: { leadRef } }), []),
    sourceOptional(
      schema,
      'leadRemarkEntry',
      'LeadRemarkEntry',
      () => source.leadRemarkEntry.findMany({ where: { leadId: sourceLeadId } }),
      []
    ),
    sourceOptional(schema, 'callNote', 'CallNote', () => source.callNote.findMany({ where: { leadId: sourceLeadId } }), []),
    sourceOptional(
      schema,
      'leadStageEvent',
      'LeadStageEvent',
      () => source.leadStageEvent.findMany({ where: { leadId: sourceLeadId } }),
      []
    ),
    sourceOptional(
      schema,
      'caseStageHistory',
      'CaseStageHistory',
      () => source.caseStageHistory.findMany({ where: { leadId: sourceLeadId } }),
      []
    ),
    sourceOptional(
      schema,
      'workflowResetLog',
      'WorkflowResetLog',
      () => source.workflowResetLog.findMany({ where: { leadId: sourceLeadId } }),
      []
    ),
    sourceOptional(
      schema,
      'caseChatMessage',
      'CaseChatMessage',
      () => source.caseChatMessage.findMany({ where: { leadId: sourceLeadId } }),
      []
    ),
    sourceOptional(
      schema,
      'chatReadReceipt',
      'ChatReadReceipt',
      () => source.chatReadReceipt.findMany({ where: { leadId: sourceLeadId } }),
      []
    ),
    sourceOptional(
      schema,
      'kypSubmission',
      'KYPSubmission',
      () =>
        source.kYPSubmission.findUnique({
          where: { leadId: sourceLeadId },
          include: {
            preAuthData: {
              include: { suggestedHospitals: true, queries: true, pdfVersions: true },
            },
          },
        }),
      null
    ),
    sourceOptional(
      schema,
      'insuranceCase',
      'InsuranceCase',
      () => source.insuranceCase.findUnique({ where: { leadId: sourceLeadId } }),
      null
    ),
    sourceOptional(
      schema,
      'insuranceInitiateForm',
      'InsuranceInitiateForm',
      () => source.insuranceInitiateForm.findUnique({ where: { leadId: sourceLeadId } }),
      null
    ),
    sourceOptional(
      schema,
      'admissionRecord',
      'AdmissionRecord',
      () =>
        source.admissionRecord.findUnique({
          where: { leadId: sourceLeadId },
          include: { implantUsages: true, prescriptionImages: true },
        }),
      null
    ),
    sourceOptional(
      schema,
      'dischargeSheet',
      'DischargeSheet',
      () => source.dischargeSheet.findUnique({ where: { leadId: sourceLeadId } }),
      null
    ),
    sourceOptional(schema, 'pLRecord', 'PLRecord', () => source.pLRecord.findUnique({ where: { leadId: sourceLeadId } }), null),
    sourceOptional(
      schema,
      'outstandingCase',
      'OutstandingCase',
      () => source.outstandingCase.findUnique({ where: { leadId: sourceLeadId } }),
      null
    ),
    sourceOptional(
      schema,
      'complianceCall',
      'ComplianceCall',
      () => source.complianceCall.findUnique({ where: { leadId: sourceLeadId } }),
      null
    ),
    sourceOptional(
      schema,
      'leadOpdPrescriptionImage',
      'LeadOpdPrescriptionImage',
      () => source.leadOpdPrescriptionImage.findMany({ where: { leadId: sourceLeadId } }),
      []
    ),
    sourceOptional(
      schema,
      'leadOpdAppointment',
      'LeadOpdAppointment',
      () =>
        source.leadOpdAppointment.findMany({
          where: { leadId: sourceLeadId },
          include: { prescriptionImages: true },
        }),
      []
    ),
    sourceOptional(
      schema,
      'paymentInstallment',
      'PaymentInstallment',
      () => source.paymentInstallment.findMany({ where: { leadId: sourceLeadId } }),
      []
    ),
    sourceOptional(
      schema,
      'invoiceRequest',
      'InvoiceRequest',
      () =>
        source.invoiceRequest.findMany({
          where: { leadId: sourceLeadId },
          include: { activityLogs: true },
        }),
      []
    ),
    sourceOptional(
      schema,
      'doctorPayoffRequest',
      'DoctorPayoffRequest',
      () =>
        source.doctorPayoffRequest.findMany({
          where: { leadId: sourceLeadId },
          include: { activityLogs: true },
        }),
      []
    ),
    sourceOptional(
      schema,
      'leadQrCallAuditLog',
      'LeadQrCallAuditLog',
      () => source.leadQrCallAuditLog.findMany({ where: { leadId: sourceLeadId } }),
      []
    ),
    sourceOptional(
      schema,
      'leadQrPublicLink',
      'LeadQrPublicLink',
      () => source.leadQrPublicLink.findMany({ where: { leadId: sourceLeadId } }),
      []
    ),
    sourceOptional(
      schema,
      'crmAssignmentPreviewLog',
      'CrmAssignmentPreviewLog',
      () => source.crmAssignmentPreviewLog.findMany({ where: { leadId: sourceLeadId } }),
      []
    ),
  ])

  return {
    remarks,
    remarkEntries,
    callNotes,
    stageEvents,
    caseHistory,
    resetLogs,
    chatMessages,
    readReceipts,
    kyp,
    insuranceCase,
    initiateForm,
    admission,
    discharge,
    pl,
    outstanding,
    compliance,
    opdImages,
    opdApps,
    installments,
    invoices,
    payoffs,
    qrLogs,
    qrLinks,
    previewLogs,
  }
}

export async function copyLeadBundle(
  source: WorkspacePrisma,
  target: WorkspacePrisma,
  leadRef: string,
  userMap: Map<string, string>,
  fallbackUserId: string,
  schema: SourceSchemaGuard,
  options: CopyLeadBundleOptions = {}
): Promise<'synced' | 'created' | 'skipped'> {
  const sourceLeadData = await fetchSourceLeadRow(source, leadRef)
  if (!sourceLeadData) return 'skipped'

  const targetLead = await target.lead.findUnique({ where: { leadRef } })
  const isCreate = !targetLead
  if (isCreate && !options.createMissing) return 'skipped'

  const sourceLeadId = sourceLeadData.id
  const targetLeadId = isCreate ? sourceLeadData.id : targetLead!.id
  const tmIds = options.treatmentMasterIds

  const [bundle, leadCreate, leadUpdate] = await Promise.all([
    options.leadOnly ? Promise.resolve(null) : fetchSourceLeadBundle(source, schema, leadRef, sourceLeadId),
    isCreate
      ? buildLeadCreateFromSourceRow(
          source,
          target,
          sourceLeadData.row,
          leadRef,
          sourceLeadData.id,
          userMap,
          fallbackUserId,
          tmIds
        )
      : Promise.resolve(null),
    !isCreate
      ? buildLeadUpdateFromSourceRow(source, target, sourceLeadData.row, userMap, fallbackUserId, tmIds)
      : Promise.resolve(null),
  ])

  await target.$transaction(
    async (tx) => {
      if (isCreate) {
        await tx.lead.create({ data: leadCreate! })
      } else {
        if (!options.leadOnly) await deleteTargetLeadBundle(tx, targetLeadId)
        await tx.lead.update({
          where: { id: targetLeadId },
          data: leadUpdate!,
        })
      }

      if (options.leadOnly || !bundle) return

      const {
        remarks,
        remarkEntries,
        callNotes,
        stageEvents,
        caseHistory,
        resetLogs,
        chatMessages,
        readReceipts,
        kyp,
        insuranceCase,
        initiateForm,
        admission,
        discharge,
        pl,
        outstanding,
        compliance,
        opdImages,
        opdApps,
        installments,
        invoices,
        payoffs,
        qrLogs,
        qrLinks,
        previewLogs,
      } = bundle

      // Legacy MySQL remarks (keyed by leadRef)
      if (remarks.length) {
        await tx.leadRemark.deleteMany({ where: { leadRef } })
        await tx.leadRemark.createMany({
          data: remarks.map(({ id: _id, ...r }) => r),
        })
      }

      if (remarkEntries.length) {
        await tx.leadRemarkEntry.createMany({
          data: remarkEntries.map(({ id, leadId: _l, createdById, ...r }) => ({
            id,
            leadId: targetLeadId,
            createdById: remapUserId(createdById, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      if (callNotes.length) {
        await tx.callNote.createMany({
          data: callNotes.map(({ id, leadId: _l, createdById, ...r }) => ({
            id,
            leadId: targetLeadId,
            createdById: remapUserId(createdById, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      if (stageEvents.length) {
        await tx.leadStageEvent.createMany({
          data: stageEvents.map(({ id, leadId: _l, changedById, ...r }) => ({
            id,
            leadId: targetLeadId,
            changedById: remapUserId(changedById, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      if (caseHistory.length) {
        await tx.caseStageHistory.createMany({
          data: caseHistory.map(({ id, leadId: _l, changedById, ...r }) => ({
            id,
            leadId: targetLeadId,
            changedById: remapUserId(changedById, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      if (resetLogs.length) {
        await tx.workflowResetLog.createMany({
          data: resetLogs.map(({ id, leadId: _l, resetById, ...r }) => ({
            id,
            leadId: targetLeadId,
            resetById: remapUserId(resetById, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      if (chatMessages.length) {
        await tx.caseChatMessage.createMany({
          data: chatMessages.map(({ id, leadId: _l, senderId, ...r }) => ({
            id,
            leadId: targetLeadId,
            senderId: remapUserId(senderId, userMap, fallbackUserId),
            ...r,
          })),
        })
      }

      if (readReceipts.length) {
        await tx.chatReadReceipt.createMany({
          data: readReceipts.map(({ id, leadId: _l, userId, ...r }) => ({
            id,
            leadId: targetLeadId,
            userId: remapUserId(userId, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      if (kyp) {
        const { preAuthData, leadId: _l, submittedById, ...kypRest } = kyp
        await tx.kYPSubmission.create({
          data: {
            ...kypRest,
            leadId: targetLeadId,
            submittedById: remapUserId(submittedById, userMap, fallbackUserId)!,
          },
        })

        if (preAuthData) {
          const {
            suggestedHospitals,
            queries,
            pdfVersions,
            kypSubmissionId: _k,
            preAuthRaisedById,
            handledById,
            heldById,
            ...preAuthRest
          } = preAuthData

          await tx.preAuthorization.create({
            data: {
              ...preAuthRest,
              kypSubmissionId: kyp.id,
              preAuthRaisedById: remapUserId(preAuthRaisedById, userMap, fallbackUserId),
              handledById: remapUserId(handledById, userMap, fallbackUserId),
              heldById: remapUserId(heldById, userMap, fallbackUserId),
            },
          })

          if (suggestedHospitals.length) {
            const seen = new Set<string>()
            const hospitalRows = suggestedHospitals
              .filter((h) => {
                const key = h.id || `${h.hospitalName}|${h.suggestedDoctor ?? ''}`
                if (seen.has(key)) return false
                seen.add(key)
                return true
              })
              .map(({ id: _id, preAuthId: _p, ...h }) => ({
                preAuthId: preAuthData.id,
                ...h,
              }))
            if (hospitalRows.length) {
              await tx.hospitalSuggestion.createMany({ data: hospitalRows })
            }
          }
          if (queries.length) {
            await tx.insuranceQuery.createMany({
              data: queries.map(({ id, preAuthorizationId: _p, raisedById, answeredById, ...q }) => ({
                id,
                preAuthorizationId: preAuthData.id,
                raisedById: remapUserId(raisedById, userMap, fallbackUserId)!,
                answeredById: remapUserId(answeredById, userMap, fallbackUserId),
                ...q,
              })),
            })
          }
          if (pdfVersions.length) {
            await tx.preAuthPDF.createMany({
              data: pdfVersions.map(({ id, preAuthorizationId: _p, createdById, ...p }) => ({
                id,
                preAuthorizationId: preAuthData.id,
                createdById: remapUserId(createdById, userMap, fallbackUserId)!,
                ...p,
              })),
            })
          }
        }
      }

      if (insuranceCase) {
        const { leadId: _l, handledById, ...rest } = insuranceCase
        await tx.insuranceCase.create({
          data: {
            ...rest,
            leadId: targetLeadId,
            handledById: remapUserId(handledById, userMap, fallbackUserId),
          },
        })
      }

      if (initiateForm) {
        const { leadId: _l, createdById, ...rest } = initiateForm
        await tx.insuranceInitiateForm.create({
          data: {
            ...rest,
            leadId: targetLeadId,
            createdById: remapUserId(createdById, userMap, fallbackUserId)!,
          },
        })
      }

      if (admission) {
        const { implantUsages, prescriptionImages, leadId: _l, initiatedById, ...rest } = admission
        await tx.admissionRecord.create({
          data: {
            ...rest,
            leadId: targetLeadId,
            initiatedById: remapUserId(initiatedById, userMap, fallbackUserId)!,
          },
        })
        if (implantUsages.length) {
          await tx.admissionRecordImplantUsage.createMany({
            data: implantUsages.map(({ id, admissionRecordId: _a, ...u }) => ({ id, admissionRecordId: admission.id, ...u })),
          })
        }
        if (prescriptionImages.length) {
          await tx.admissionRecordPrescriptionImage.createMany({
            data: prescriptionImages.map(({ id, admissionRecordId: _a, ...u }) => ({ id, admissionRecordId: admission.id, ...u })),
          })
        }
      }

      if (discharge) {
        const { leadId: _l, ...rest } = discharge
        await tx.dischargeSheet.create({ data: { ...rest, leadId: targetLeadId } })
      }

      if (pl) {
        const { leadId: _l, ...rest } = pl
        await tx.pLRecord.create({ data: { ...rest, leadId: targetLeadId } })
      }

      if (outstanding) {
        const { leadId: _l, ...rest } = outstanding
        await tx.outstandingCase.create({ data: { ...rest, leadId: targetLeadId } })
      }

      if (compliance) {
        const { leadId: _l, calledByUserId, ...rest } = compliance
        await tx.complianceCall.create({
          data: {
            ...rest,
            leadId: targetLeadId,
            calledByUserId: remapUserId(calledByUserId, userMap, fallbackUserId),
          },
        })
      }

      if (opdImages.length) {
        await tx.leadOpdPrescriptionImage.createMany({
          data: opdImages.map(({ id, leadId: _l, ...r }) => ({ id, leadId: targetLeadId, ...r })),
        })
      }

      for (const app of opdApps) {
        const { prescriptionImages, leadId: _l, createdById, updatedById, ...rest } = app
        await tx.leadOpdAppointment.create({
          data: {
            ...rest,
            leadId: targetLeadId,
            createdById: remapUserId(createdById, userMap, fallbackUserId),
            updatedById: remapUserId(updatedById, userMap, fallbackUserId),
          },
        })
        if (prescriptionImages.length) {
          await tx.leadOpdAppointmentPrescriptionImage.createMany({
            data: prescriptionImages.map(({ id, opdAppointmentId: _a, ...r }) => ({ id, opdAppointmentId: app.id, ...r })),
          })
        }
      }

      if (installments.length) {
        await tx.paymentInstallment.createMany({
          data: installments.map(({ id, leadId: _l, recordedById, ...r }) => ({
            id,
            leadId: targetLeadId,
            recordedById: remapUserId(recordedById, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      for (const inv of invoices) {
        const { activityLogs, leadId: _l, requestedById, reviewedById, ...rest } = inv
        await tx.invoiceRequest.create({
          data: {
            ...rest,
            leadId: targetLeadId,
            requestedById: remapUserId(requestedById, userMap, fallbackUserId)!,
            reviewedById: remapUserId(reviewedById, userMap, fallbackUserId),
          },
        })
        if (activityLogs.length) {
          await tx.invoiceRequestActivity.createMany({
            data: activityLogs.map(({ id, requestId: _r, actorId, ...a }) => ({
              id,
              requestId: inv.id,
              actorId: remapUserId(actorId, userMap, fallbackUserId)!,
              ...a,
            })),
          })
        }
      }

      for (const p of payoffs) {
        const { activityLogs, leadId: _l, requestedById, reviewedById, ...rest } = p
        await tx.doctorPayoffRequest.create({
          data: {
            ...rest,
            leadId: targetLeadId,
            requestedById: remapUserId(requestedById, userMap, fallbackUserId)!,
            reviewedById: remapUserId(reviewedById, userMap, fallbackUserId),
          },
        })
        if (activityLogs.length) {
          await tx.doctorPayoffRequestActivity.createMany({
            data: activityLogs.map(({ id, requestId: _r, actorId, ...a }) => ({
              id,
              requestId: p.id,
              actorId: remapUserId(actorId, userMap, fallbackUserId)!,
              ...a,
            })),
          })
        }
      }

      if (qrLogs.length) {
        await tx.leadQrCallAuditLog.createMany({
          data: qrLogs.map(({ id, leadId: _l, userId, ...r }) => ({
            id,
            leadId: targetLeadId,
            userId: remapUserId(userId, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      if (qrLinks.length) {
        await tx.leadQrPublicLink.createMany({
          data: qrLinks.map(({ id, leadId: _l, actorUserId, ...r }) => ({
            id,
            leadId: targetLeadId,
            actorUserId: remapUserId(actorUserId, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      if (previewLogs.length) {
        await tx.crmAssignmentPreviewLog.createMany({
          data: previewLogs.map(({ id, leadId: _l, ...r }) => ({ id, leadId: targetLeadId, ...r })),
        })
      }
    },
    { timeout: 120_000 }
  )

  return isCreate ? 'created' : 'synced'
}
