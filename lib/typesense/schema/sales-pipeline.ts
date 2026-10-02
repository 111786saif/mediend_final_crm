import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections'
import { mapStatusCode } from '@/lib/mysql-code-mappings'
import { normalizeModeOfPaymentLabel } from '@/lib/mode-of-payment'
import { resolveLeadCity, resolveLeadHospitalDoctor, resolveLeadSourceDisplay } from '@/lib/lead-display'
import { getLeadAgeInfo } from '@/lib/pipeline-lead-buckets'

export const SALES_PIPELINE_COLLECTION_NAME = process.env.TYPESENSE_SALES_PIPELINE_COLLECTION || 'sales-pipeline'

// Schema covering all columns rendered in sales-pipeline-page.tsx
export const salesPipelineSchema: CollectionCreateSchema = {
  name: SALES_PIPELINE_COLLECTION_NAME,
  fields: [
    { name: 'id', type: 'string' },
    { name: 'leadRef', type: 'string', facet: true, sort: true },
    { name: 'patientName', type: 'string', sort: true },
    { name: 'phoneNumber', type: 'string', optional: true },
    { name: 'alternateNumber', type: 'string', optional: true },
    { name: 'whatsapp', type: 'string', optional: true },
    { name: 'phoneSearchDigits', type: 'string', optional: true },
    { name: 'age', type: 'int32', facet: true, optional: true },
    { name: 'sex', type: 'string', facet: true, optional: true },
    { name: 'month', type: 'string', facet: true, optional: true },
    { name: 'circle', type: 'string', facet: true, optional: true },
    { name: 'city', type: 'string', facet: true, optional: true },
    { name: 'category', type: 'string', facet: true, optional: true },
    { name: 'treatment', type: 'string', facet: true, optional: true },
    { name: 'planningTreatment', type: 'string', optional: true },
    { name: 'hospitalName', type: 'string', facet: true, optional: true },
    { name: 'doctorName', type: 'string', facet: true, optional: true },
    { name: 'teamLeadId', type: 'string', facet: true, optional: true },
    { name: 'teamLeadName', type: 'string', facet: true, optional: true },
    { name: 'bdId', type: 'string', facet: true, optional: true },
    { name: 'bdName', type: 'string', facet: true, sort: true, optional: true },
    { name: 'managerName', type: 'string', facet: true, optional: true },
    { name: 'status', type: 'string', facet: true, sort: true, optional: true },
    { name: 'caseStage', type: 'string', facet: true, optional: true },
    { name: 'pipelineStage', type: 'string', facet: true, optional: true },
    { name: 'subStatus', type: 'string', facet: true, optional: true },
    { name: 'mop', type: 'string', facet: true, optional: true },
    { name: 'insuranceName', type: 'string', facet: true, optional: true },
    { name: 'flowType', type: 'string', facet: true, optional: true },
    { name: 'profession', type: 'string', facet: true, optional: true },
    { name: 'preferredLocation', type: 'string', facet: true, optional: true },
    { name: 'source', type: 'string', facet: true, optional: true },
    { name: 'campaignName', type: 'string', facet: true, optional: true },
    { name: 'campaignSourceDisplay', type: 'string', optional: true },
    { name: 'assignedDate', type: 'int64', optional: true, sort: true },
    { name: 'leadEntryDate', type: 'int64', optional: true, sort: true },
    { name: 'createdDate', type: 'int64', optional: true, sort: true },
    { name: 'updatedDate', type: 'int64', optional: true, sort: true },
    { name: 'followUpDate', type: 'int64', optional: true, sort: true },
    { name: 'surgeryDate', type: 'int64', optional: true, sort: true },
    { name: 'assignedDateStr', type: 'string', optional: true },
    { name: 'leadEntryDateStr', type: 'string', optional: true },
    { name: 'createdDateStr', type: 'string', optional: true },
    { name: 'followUpDateStr', type: 'string', optional: true },
    { name: 'surgeryDateStr', type: 'string', optional: true },
    { name: 'openedInCrmAt', type: 'int64', optional: true, sort: true },
    { name: 'openedInCrmAtStr', type: 'string', optional: true },
    { name: 'ipdPotentialDate', type: 'int64', optional: true, sort: true },
    { name: 'ipdPotentialDateStr', type: 'string', optional: true },
    { name: 'ipdDrName', type: 'string', optional: true },
    { name: 'removeRemarks', type: 'bool', optional: true },
    { name: 'remarksClearedAt', type: 'int64', optional: true },
    { name: 'remarksClearedAtStr', type: 'string', optional: true },
    { name: 'removeFollowUpDate', type: 'bool', optional: true },
    { name: 'followUpDateClearedAt', type: 'int64', optional: true },
    { name: 'followUpDateClearedAtStr', type: 'string', optional: true },
    { name: 'modifyBy', type: 'string', facet: true, optional: true },
    { name: 'duplCount', type: 'int32', optional: true },
    { name: 'remarks', type: 'string', optional: true },
    { name: 'latestRemark', type: 'string', optional: true },
    { name: 'recency', type: 'string', facet: true, optional: true },
  ],
}

// Fields prioritized during full-text multi-column search covering all table columns
export const SALES_PIPELINE_QUERY_BY_FIELDS = [
  'patientName',
  'leadRef',
  'phoneNumber',
  'alternateNumber',
  'whatsapp',
  'phoneSearchDigits',
  'remarks',
  'latestRemark',
  'treatment',
  'planningTreatment',
  'hospitalName',
  'doctorName',
  'bdName',
  'teamLeadName',
  'managerName',
  'circle',
  'city',
  'category',
  'status',
  'subStatus',
  'caseStage',
  'pipelineStage',
  'sex',
  'month',
  'recency',
  'campaignName',
  'campaignSourceDisplay',
  'source',
  'insuranceName',
  'profession',
  'mop',
  'preferredLocation',
  'modifyBy',
  'assignedDateStr',
  'leadEntryDateStr',
  'createdDateStr',
  'followUpDateStr',
  'surgeryDateStr',
].join(',')

// Typesense document interface for Sales Pipeline
export interface SalesPipelineDocument {
  id: string
  leadRef: string
  patientName: string
  phoneNumber?: string
  alternateNumber?: string
  whatsapp?: string
  phoneSearchDigits?: string
  age?: number
  sex?: string
  month?: string
  circle?: string
  city?: string
  category?: string
  treatment?: string
  planningTreatment?: string
  hospitalName?: string
  doctorName?: string
  teamLeadId?: string
  teamLeadName?: string
  bdId?: string
  bdName?: string
  managerName?: string
  status?: string
  caseStage?: string
  pipelineStage?: string
  subStatus?: string
  mop?: string
  insuranceName?: string
  flowType?: string
  profession?: string
  preferredLocation?: string
  source?: string
  campaignName?: string
  campaignSourceDisplay?: string
  assignedDate?: number | null
  leadEntryDate?: number | null
  createdDate?: number | null
  updatedDate?: number | null
  followUpDate?: number | null
  surgeryDate?: number | null
  assignedDateStr?: string
  leadEntryDateStr?: string
  createdDateStr?: string
  followUpDateStr?: string
  surgeryDateStr?: string
  openedInCrmAt?: number | null
  openedInCrmAtStr?: string
  ipdPotentialDate?: number | null
  ipdPotentialDateStr?: string
  ipdDrName?: string
  removeRemarks?: boolean
  remarksClearedAt?: number | null
  remarksClearedAtStr?: string
  removeFollowUpDate?: boolean
  followUpDateClearedAt?: number | null
  followUpDateClearedAtStr?: string
  modifyBy?: string
  duplCount?: number
  remarks?: string
  latestRemark?: string
  recency?: string
}

// Helper to convert date to Unix timestamp in seconds
export function toUnixSeconds(dateVal: Date | string | null | undefined): number | null {
  if (!dateVal) return null
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal
  const time = d.getTime()
  return Number.isNaN(time) ? null : Math.floor(time / 1000)
}

// Helper to format date to full ISO 8601 string (preserving time)
export function toFullIsoStr(dateVal: Date | string | null | undefined): string | undefined {
  if (!dateVal) return undefined
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

// Helper to format date to ISO YYYY-MM-DD string
export function toIsoDateStr(dateVal: Date | string | null | undefined): string | undefined {
  if (!dateVal) return undefined
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

// Maps a Prisma Lead record into a Typesense SalesPipelineDocument
export function mapLeadToSalesPipelineDocument(lead: any): SalesPipelineDocument {
  const resolvedHd = resolveLeadHospitalDoctor(lead)
  const resolvedCity = resolveLeadCity(lead)
  const resolvedSourceDisplay = resolveLeadSourceDisplay(lead)
  const ageInfo = getLeadAgeInfo(lead)

  // Extract pure digits for substring phone searching
  const phoneNumbers = [lead.phoneNumber, lead.alternateNumber, lead.whatsapp]
    .filter(Boolean)
    .join(' ')
  const phoneSearchDigits = phoneNumbers.replace(/\D/g, '')

  const latestRemarkContent =
    lead.latestRemark?.content ||
    lead.leadRemarkEntries?.[0]?.content ||
    (typeof lead.remarks === 'string' ? lead.remarks : '')

  return {
    id: String(lead.id),
    leadRef: String(lead.leadRef ?? ''),
    patientName: String(lead.patientName ?? ''),
    phoneNumber: lead.phoneNumber || undefined,
    alternateNumber: lead.alternateNumber || undefined,
    whatsapp: lead.whatsapp || undefined,
    phoneSearchDigits: phoneSearchDigits || undefined,
    age: typeof lead.age === 'number' ? lead.age : undefined,
    sex: lead.sex || undefined,
    month: lead.month || undefined,
    circle: lead.circle || undefined,
    city: resolvedCity || lead.circle || undefined,
    category: lead.category || undefined,
    treatment: lead.treatment || undefined,
    planningTreatment: lead.diseaseDetails || undefined,
    hospitalName: resolvedHd.hospital || lead.hospitalName || undefined,
    doctorName: resolvedHd.doctor || lead.surgeonName || lead.ipdDrName || undefined,
    teamLeadId: lead.teamLeadId ? String(lead.teamLeadId) : undefined,
    teamLeadName: lead.teamLeadId ? String(lead.teamLeadId) : undefined,
    bdId: lead.bdId || lead.bd?.id || undefined,
    bdName: lead.bd?.name || undefined,
    managerName: lead.bd?.employee?.manager?.user?.name || undefined,
    status: mapStatusCode(lead.status) || undefined,
    caseStage: lead.caseStage || undefined,
    pipelineStage: lead.pipelineStage || undefined,
    subStatus: lead.subStatus != null ? String(lead.subStatus) : undefined,
    mop: normalizeModeOfPaymentLabel(lead.modeOfPayment) || undefined,
    insuranceName: lead.insuranceName || undefined,
    flowType: lead.flowType || undefined,
    profession: lead.profession || undefined,
    preferredLocation: resolvedCity || lead.circle || undefined,
    source: lead.source || undefined,
    campaignName: lead.campaignName || undefined,
    campaignSourceDisplay: resolvedSourceDisplay || undefined,
    assignedDate: toUnixSeconds(lead.assignedDate),
    leadEntryDate: toUnixSeconds(lead.leadEntryDate),
    createdDate: toUnixSeconds(lead.createdDate),
    updatedDate: toUnixSeconds(lead.updatedDate),
    followUpDate: toUnixSeconds(lead.followUpDate),
    surgeryDate: toUnixSeconds(lead.surgeryDate || lead.admissionRecord?.surgeryDate),
    openedInCrmAt: toUnixSeconds(lead.openedInCrmAt),
    ipdPotentialDate: toUnixSeconds(lead.ipdPotentialDate),
    remarksClearedAt: toUnixSeconds(lead.remarksClearedAt),
    followUpDateClearedAt: toUnixSeconds(lead.followUpDateClearedAt),
    assignedDateStr: toFullIsoStr(lead.assignedDate),
    leadEntryDateStr: toFullIsoStr(lead.leadEntryDate),
    createdDateStr: toFullIsoStr(lead.createdDate),
    followUpDateStr: toFullIsoStr(lead.followUpDate),
    surgeryDateStr: toFullIsoStr(lead.surgeryDate || lead.admissionRecord?.surgeryDate),
    openedInCrmAtStr: toFullIsoStr(lead.openedInCrmAt),
    ipdPotentialDateStr: toFullIsoStr(lead.ipdPotentialDate),
    remarksClearedAtStr: toFullIsoStr(lead.remarksClearedAt),
    followUpDateClearedAtStr: toFullIsoStr(lead.followUpDateClearedAt),
    ipdDrName: lead.ipdDrName || undefined,
    removeRemarks: Boolean(lead.removeRemarks),
    removeFollowUpDate: Boolean(lead.removeFollowUpDate),
    modifyBy: lead.updatedBy?.name || undefined,
    duplCount: typeof lead.duplCount === 'number' ? lead.duplCount : undefined,
    remarks: typeof lead.remarks === 'string' ? lead.remarks : undefined,
    latestRemark: latestRemarkContent || undefined,
    recency: ageInfo.filter,
  }
}
