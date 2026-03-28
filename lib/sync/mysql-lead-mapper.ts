import { PipelineStage, UserRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import type { LookupMaps } from './mysql-lookup-cache'

/**
 * MySQL Lead row structure (based on DESCRIBE lead output)
 */
export interface MySQLLeadRow {
  id: number
  month?: string | null
  Lead_Date?: Date | string | null
  LeadEntryDate?: Date | string | null
  create_date?: Date | string | null
  assignedDate?: Date | string | null
  assigned_date?: Date | string | null
  assignmentDate?: Date | string | null
  assign_date?: Date | string | null
  Patient_Number: string
  AlternativePhone?: string | null
  Whatsapp?: string | null
  Patient_Name: string
  PatientEmail?: string | null
  Age?: number | null
  Sex?: string | null
  Circle?: number | string | null
  city_option?: number | string | null
  address?: string | null
  doc_upload?: string | null
  Category?: number | string | null
  Treatment?: number | string | null
  DiseaseDetails?: string | null
  BDM?: string | number | null
  TL?: number | null
  remarks_id?: string | null
  Remarks?: string | null
  LastRemarks?: string | null
  Follow_up_Date?: Date | string | null
  Status?: number | string | null
  SubStatus?: number | null
  Surgery_Date?: Date | string | null
  OPD_Hospital?: string | null
  OPD_DrName?: string | null
  OPD_ContactNo?: string | null
  OPD_Charges?: number | null
  OPD_ScheduleDate?: Date | string | null
  OPD_Meeting?: number | null
  IPD_AdmisisonDate?: Date | string | null
  IPD_Hospital?: string | null
  IPD_DrName?: string | null
  IPD_ContactNo?: string | null
  IPD_TotalPayment?: number | null
  MOP?: string | null
  PaymentDetails?: number | null
  Attendant?: number | boolean | null
  AttendantName?: string | null
  AttendantContactNo?: string | null
  IPD_Details?: string | null
  WA_Format?: string | null
  Source?: number | null
  Lead_Source?: number | null
  WA_Message?: string | null
  Notification?: number | boolean | null
  email?: number | boolean | null
  sms?: number | boolean | null
  whatsapp_msg?: number | boolean | null
  create_by?: number | null
  update_by?: number | null
  update_date?: Date | string | null
  ip?: string | null
  website?: string | null
  description?: string | null
  refid?: string | null
  DuplCount?: number | null
  aes?: number | boolean | null
  Profession?: string | null
  QR?: string | null
  RemoveRemarks?: number | boolean | null
  ad_id?: string | null
  campaign_id?: string | null
  form_id?: string | null
}

export type BdMap = Map<string, { id: string }>

/**
 * Finds a BD user by name using multiple matching strategies (async fallback for rare cases)
 */
async function findBDByName(name: string): Promise<{ id: string } | null> {
  if (!name) return null

  const trimmedName = name.trim()

  let user = await prisma.user.findFirst({
    where: {
      role: UserRole.BD,
      name: { equals: trimmedName, mode: 'insensitive' },
    },
    select: { id: true },
  })
  if (user) return { id: user.id }

  user = await prisma.user.findFirst({
    where: {
      role: UserRole.BD,
      name: { contains: trimmedName, mode: 'insensitive' },
    },
    select: { id: true },
  })
  if (user) return { id: user.id }

  const firstName = trimmedName.split(' ')[0]
  if (firstName && firstName.length > 2) {
    user = await prisma.user.findFirst({
      where: {
        role: UserRole.BD,
        name: { startsWith: firstName, mode: 'insensitive' },
      },
      select: { id: true },
    })
    if (user) return { id: user.id }
  }

  return null
}

/**
 * Creates a new BD user (async fallback for rare cases)
 */
async function createBDUser(
  name: string,
  systemUserId: string
): Promise<{ id: string }> {
  const emailBase = name
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '')
  let email = `${emailBase}@mediend.local`
  let counter = 1

  while (await prisma.user.findUnique({ where: { email } })) {
    email = `${emailBase}${counter}@mediend.local`
    counter++
  }

  const defaultPassword = await hashPassword('Temp@123')
  const newUser = await prisma.user.create({
    data: {
      email,
      passwordHash: defaultPassword,
      name: name.trim(),
      role: UserRole.BD,
    },
    select: { id: true },
  })

  return { id: newUser.id }
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const parsed = new Date(value)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Get the canonical "lead received" date: Lead_Date (primary) → LeadEntryDate → create_date.
 */
export function getLeadReceivedDate(row: {
  Lead_Date?: Date | string | null
  LeadEntryDate?: Date | string | null
  create_date?: Date | string | null
}): Date {
  return (
    parseDate(row.Lead_Date) ??
    parseDate(row.LeadEntryDate) ??
    parseDate(row.create_date) ??
    new Date(0)
  )
}

export function getLeadAssignmentDate(row: {
  assignedDate?: Date | string | null
  assigned_date?: Date | string | null
  assignmentDate?: Date | string | null
  assign_date?: Date | string | null
}): Date | null {
  return (
    parseDate(row.assignedDate) ??
    parseDate(row.assigned_date) ??
    parseDate(row.assignmentDate) ??
    parseDate(row.assign_date) ??
    null
  )
}

function parseBoolean(value: number | boolean | null | undefined): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'boolean') return value
  return value === 1
}

function toString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return String(value)
}

function toInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = parseInt(String(value), 10)
  return isNaN(parsed) ? null : parsed
}

function resolveStatus(
  status: number | string | null | undefined,
  lookups: LookupMaps
): string {
  if (status === null || status === undefined) return 'New Lead'
  const normalized = String(status).trim()
  if (/^\d+$/.test(normalized)) {
    const resolved = lookups.status.get(parseInt(normalized, 10))
    if (resolved) return resolved
  }
  const statusMap: Record<string, string> = {
    'new lead': 'New Lead',
    'new': 'New Lead',
    'ipd done': 'IPD Done',
    'closed': 'Closed',
    'follow-up 1': 'Follow-up 1',
    'follow-up 2': 'Follow-up 2',
    'follow-up 3': 'Follow-up 3',
  }
  return statusMap[normalized.toLowerCase()] ?? normalized
}

/**
 * Infer pipeline stage from MySQL status.
 */
export function inferPipelineStage(status: string | null | undefined): PipelineStage {
  if (!status) return PipelineStage.SALES
  const s = String(status).trim().toLowerCase()
  if (s === 'ipd done') return PipelineStage.COMPLETED
  if (
    s === 'closed' ||
    s === 'ipd lost' ||
    s === 'junk' ||
    s === 'not interested' ||
    s === 'invalid number' ||
    s === 'duplicate lead' ||
    s === 'lost' ||
    s === 'already insured' ||
    s.startsWith('dnp')
  ) {
    return PipelineStage.LOST
  }
  return PipelineStage.SALES
}

export interface MapMySQLLeadResult {
  leadRef: string
  patientName: string
  age: number
  sex: string
  phoneNumber: string
  alternateNumber: string | null
  attendantName: string | null
  bdId: string
  status: string
  pipelineStage: PipelineStage
  circle: string
  category: string | null
  treatment: string | null
  hospitalName: string
  createdById: string
  updatedById: string
  createdDate: Date
  updatedDate: Date | null
  source: string | null
  campaignName: string | null
  [key: string]: unknown
}

/**
 * Maps MySQL lead row to Prisma Lead create/update data (synchronous when BD is in bdMap).
 * Returns null if BD not found in bdMap — caller should use mapMySQLLeadToPrismaAsyncFallback.
 */
export function mapMySQLLeadToPrisma(
  mysqlRow: MySQLLeadRow,
  systemUserId: string,
  lookups: LookupMaps,
  bdMap: BdMap
): MapMySQLLeadResult | null {
  const bdmValue = mysqlRow.BDM ? String(mysqlRow.BDM).trim() : null
  if (!bdmValue) return null

  let bdInfo: { id: string } | null = null

  const isNumeric = /^\d+$/.test(bdmValue)
  if (isNumeric) {
    bdInfo = bdMap.get(bdmValue) ?? bdMap.get(`bd-${bdmValue}`) ?? null
  }
  if (!bdInfo) {
    bdInfo = bdMap.get(bdmValue.toLowerCase()) ?? null
  }
  if (!bdInfo) {
    const firstName = bdmValue.split(' ')[0]
    if (firstName && firstName.length > 2) {
      bdInfo = bdMap.get(firstName.toLowerCase()) ?? null
    }
  }

  if (!bdInfo) return null

  return buildLeadData(mysqlRow, systemUserId, lookups, bdInfo, bdmValue)
}

/**
 * Async fallback for leads whose BD is not in bdMap (rare). Tries findBDByName and createBDUser.
 */
export async function mapMySQLLeadToPrismaAsyncFallback(
  mysqlRow: MySQLLeadRow,
  systemUserId: string,
  lookups: LookupMaps,
  autoCreateBD: boolean = true
): Promise<MapMySQLLeadResult | null> {
  const bdmValue = mysqlRow.BDM ? String(mysqlRow.BDM).trim() : null
  if (!bdmValue) return null

  let bdInfo: { id: string } | null = null
  const isNumeric = /^\d+$/.test(bdmValue)

  bdInfo = await findBDByName(bdmValue)
  if (!bdInfo && isNumeric) {
    bdInfo = await findBDByName(`BD-${bdmValue}`)
  }
  if (!bdInfo && autoCreateBD) {
    try {
      bdInfo = await createBDUser(isNumeric ? `BD-${bdmValue}` : bdmValue, systemUserId)
      console.log(`Created new BD user for lead ${mysqlRow.id}`)
    } catch {
      return null
    }
  }

  if (!bdInfo) return null

  return buildLeadData(mysqlRow, systemUserId, lookups, bdInfo, bdmValue)
}

function buildLeadData(
  mysqlRow: MySQLLeadRow,
  systemUserId: string,
  lookups: LookupMaps,
  bdInfo: { id: string },
  bdmValue: string
): MapMySQLLeadResult {
  const campaignInfo =
    mysqlRow.Lead_Source != null
      ? lookups.campaign.get(Number(mysqlRow.Lead_Source))
      : null

  const sourceName =
    campaignInfo?.sourceName ??
    (mysqlRow.Source != null ? lookups.source.get(Number(mysqlRow.Source)) : null) ??
    null

  const campaignName = campaignInfo?.campaignName ?? null

  const treatmentName =
    campaignInfo?.treatmentName ??
    (mysqlRow.Treatment != null
      ? lookups.treatment.get(Number(mysqlRow.Treatment))
      : null) ??
    null

  const circleName =
    mysqlRow.Circle != null
      ? lookups.circle.get(Number(mysqlRow.Circle)) ?? null
      : null

  const categoryName =
    mysqlRow.Category != null
      ? lookups.category.get(Number(mysqlRow.Category)) ?? null
      : null

  const statusName = resolveStatus(mysqlRow.Status, lookups)

  const leadDate = getLeadReceivedDate(mysqlRow)
  const updateDate = parseDate(mysqlRow.update_date)
  const pipelineStage = inferPipelineStage(statusName)
  const surgeryDate = parseDate(mysqlRow.Surgery_Date)
  const ipdAdmissionDate = parseDate(mysqlRow.IPD_AdmisisonDate)
  const conversionDate =
    pipelineStage === PipelineStage.COMPLETED
      ? surgeryDate ?? ipdAdmissionDate ?? updateDate ?? leadDate
      : null

  return {
    leadRef: String(mysqlRow.id),
    patientName: mysqlRow.Patient_Name || 'Unknown',
    age: mysqlRow.Age ?? 0,
    sex: mysqlRow.Sex || 'Not Specified',
    phoneNumber: mysqlRow.Patient_Number || '0000000000',
    alternateNumber: toString(mysqlRow.AlternativePhone),
    attendantName: toString(mysqlRow.AttendantName),
    bdId: bdInfo.id,
    bdeName: bdmValue,
    status: statusName,
    pipelineStage,
    conversionDate,
    circle: circleName ?? 'Unknown',
    category: categoryName,
    treatment: treatmentName,
    hospitalName: mysqlRow.OPD_Hospital || mysqlRow.IPD_Hospital || 'Not Specified',
    createdById: systemUserId,
    updatedById: systemUserId,
    createdDate: leadDate,
    updatedDate: updateDate ?? null,

    month: toString(mysqlRow.month),
    leadDate,
    leadEntryDate: parseDate(mysqlRow.LeadEntryDate),
    patientEmail: toString(mysqlRow.PatientEmail),
    whatsapp: toString(mysqlRow.Whatsapp),
    address: toString(mysqlRow.address),
    docUpload: toString(mysqlRow.doc_upload),
    diseaseDetails: toString(mysqlRow.DiseaseDetails),
    followUpDate: parseDate(mysqlRow.Follow_up_Date),
    subStatus: toInt(mysqlRow.SubStatus),
    opdHospital: toString(mysqlRow.OPD_Hospital),
    opdDrName: toString(mysqlRow.OPD_DrName),
    opdContactNo: toString(mysqlRow.OPD_ContactNo),
    opdCharges: mysqlRow.OPD_Charges ?? 0,
    opdScheduleDate: parseDate(mysqlRow.OPD_ScheduleDate),
    opdMeeting: toInt(mysqlRow.OPD_Meeting),
    ipdAdmissionDate: parseDate(mysqlRow.IPD_AdmisisonDate),
    ipdHospital: toString(mysqlRow.IPD_Hospital),
    ipdDrName: toString(mysqlRow.IPD_DrName),
    ipdContactNo: toString(mysqlRow.IPD_ContactNo),
    ipdTotalPayment: mysqlRow.IPD_TotalPayment ?? 0,
    ipdDetails: toString(mysqlRow.IPD_Details),
    paymentDetails: toInt(mysqlRow.PaymentDetails),
    attendantContactNo: toString(mysqlRow.AttendantContactNo),
    waFormat: toString(mysqlRow.WA_Format),
    leadSource: toInt(mysqlRow.Lead_Source),
    whatsappMessage: toString(mysqlRow.WA_Message),
    notification: parseBoolean(mysqlRow.Notification),
    emailSent: parseBoolean(mysqlRow.email),
    smsSent: parseBoolean(mysqlRow.sms),
    whatsappSent: parseBoolean(mysqlRow.whatsapp_msg),
    website: toString(mysqlRow.website),
    description: toString(mysqlRow.description),
    refId: toString(mysqlRow.refid),
    duplCount: mysqlRow.DuplCount ?? 0,
    aes: parseBoolean(mysqlRow.aes),
    profession: toString(mysqlRow.Profession),
    qr: toString(mysqlRow.QR),
    removeRemarks: parseBoolean(mysqlRow.RemoveRemarks),
    adId: toString(mysqlRow.ad_id),
    campaignId: toString(mysqlRow.campaign_id),
    formId: toString(mysqlRow.form_id),
    teamLeadId: toInt(mysqlRow.TL),
    remarksId: toString(mysqlRow.remarks_id),
    remarks: toString(mysqlRow.LastRemarks || mysqlRow.Remarks),
    source: sourceName,
    campaignName,
    modeOfPayment: toString(mysqlRow.MOP),
    surgeryDate: parseDate(mysqlRow.Surgery_Date),
  }
}
