import 'dotenv/config'
import { Client } from 'typesense'
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections'
import type { SearchParams } from 'typesense/lib/Typesense/Documents'
import {
  SALES_PIPELINE_COLLECTION_NAME,
  SALES_PIPELINE_QUERY_BY_FIELDS,
  salesPipelineSchema,
  mapLeadToSalesPipelineDocument,
  type SalesPipelineDocument,
  EMPLOYEE_HIERARCHY_COLLECTION_NAME,
  employeeHierarchySchema,
  type EmployeeHierarchyDocument,
} from './schema'
import { maskPhoneNumber } from '@/lib/phone-utils'
import { getEmployeeByUserId, getSubordinates } from '@/lib/hierarchy'

// Configuration interface for connecting to Typesense server
export interface TypesenseServerConfig {
  nodes: Array<{
    host: string
    port: number
    protocol: string
    path?: string
  }>
  apiKey: string
  connectionTimeoutSeconds: number
  isConfigured: boolean
}

// Parses environment variables to build the Typesense connection configuration
export function getTypesenseConfig(): TypesenseServerConfig {
  const apiKey = process.env.TYPESENSE_API_KEY || ''
  const fullUrl = process.env.TYPESENSE_URL || process.env.TYPESENSE_ENDPOINT || ''
  const timeoutSeconds = Number(process.env.TYPESENSE_CONNECTION_TIMEOUT_SECONDS) || 5

  if (fullUrl) {
    try {
      const parsed = new URL(fullUrl)
      const protocol = parsed.protocol.replace(':', '') || 'http'
      const port = parsed.port ? Number(parsed.port) : protocol === 'https' ? 443 : 80
      const host = parsed.hostname
      const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/$/, '') : ''

      return {
        nodes: [{ host, port, protocol, path }],
        apiKey,
        connectionTimeoutSeconds: timeoutSeconds,
        isConfigured: Boolean(apiKey && host && apiKey !== 'xyz_typesense_api_key'),
      }
    } catch (e) {
      console.warn('[Typesense] Invalid TYPESENSE_URL provided, falling back to host/port variables:', e)
    }
  }

  const host = process.env.TYPESENSE_HOST || 'localhost'
  const port = Number(process.env.TYPESENSE_PORT) || 8108
  const protocol = process.env.TYPESENSE_PROTOCOL || 'http'

  return {
    nodes: [{ host, port, protocol, path: '' }],
    apiKey,
    connectionTimeoutSeconds: timeoutSeconds,
    isConfigured: Boolean(apiKey && apiKey !== 'xyz_typesense_api_key' && host),
  }
}

// Checks if Typesense is properly configured with an API key and host
export function isTypesenseConfigured(): boolean {
  return getTypesenseConfig().isConfigured
}

let cachedClient: Client | null = null

// Returns the cached singleton instance of Typesense client
export function getTypesenseClient(): Client {
  if (cachedClient) return cachedClient

  const config = getTypesenseConfig()

  cachedClient = new Client({
    nodes: config.nodes,
    apiKey: config.apiKey,
    connectionTimeoutSeconds: config.connectionTimeoutSeconds,
    retryIntervalSeconds: 0.5,
    numRetries: 3,
  })

  return cachedClient
}

// Resets cached client instance if credentials change
export function resetTypesenseClient(): void {
  cachedClient = null
}

// Verifies connectivity to the Typesense server
export async function checkTypesenseHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    if (!isTypesenseConfigured()) {
      return { ok: false, message: 'Typesense is not configured in .env' }
    }
    const client = getTypesenseClient()
    const health = await client.health.retrieve()
    return { ok: health.ok, message: health.ok ? 'Typesense server is healthy' : 'Typesense returned unhealthy' }
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Failed to connect to Typesense server' }
  }
}

// Creates a collection if it does not already exist
export async function ensureCollection(schema: CollectionCreateSchema): Promise<void> {
  const client = getTypesenseClient()
  try {
    await client.collections(schema.name).retrieve()
  } catch (err: any) {
    if (err?.httpStatus === 404) {
      await client.collections().create(schema)
    } else {
      throw err
    }
  }
}

// Deletes a collection from Typesense
export async function deleteCollection(collectionName: string): Promise<void> {
  const client = getTypesenseClient()
  try {
    await client.collections(collectionName).delete()
  } catch (err: any) {
    if (err?.httpStatus !== 404) {
      throw err
    }
  }
}

// Batch upserts documents into a specified collection
export async function upsertDocuments<T extends Record<string, any>>(
  collectionName: string,
  documents: T[]
): Promise<any> {
  if (documents.length === 0) return []
  const client = getTypesenseClient()
  return await client.collections(collectionName).documents().import(documents, { action: 'upsert' })
}

// Executes a search query on a given collection
export async function searchCollection<T extends Record<string, any>>(
  collectionName: string,
  searchParameters: SearchParams<any>
) {
  const client = getTypesenseClient()
  return await client.collections<T>(collectionName).documents().search(searchParameters)
}

// Parameters for searching the sales pipeline collection
export interface SalesPipelineSearchOptions {
  page?: number
  perPage?: number
  filterBy?: string
  sortBy?: string
  queryBy?: string
  facetBy?: string
  highlightFullFields?: string
}

// Search result structure for sales pipeline
export interface SalesPipelineSearchResult {
  hits: Array<{
    document: SalesPipelineDocument
    highlight?: Record<string, any>
    textMatch?: number
  }>
  matchedLeadIds: string[]
  found: number
  page: number
  totalPages: number
  searchTimeMs: number
}

// Ensures the sales pipeline collection exists in Typesense
export async function ensureSalesPipelineCollection(): Promise<void> {
  await ensureCollection(salesPipelineSchema)
}

// Drops and recreates the sales pipeline collection empty, clearing all synced documents
export async function resetSalesPipelineCollection(): Promise<void> {
  const client = getTypesenseClient()
  await deleteCollection(SALES_PIPELINE_COLLECTION_NAME)
  await client.collections().create(salesPipelineSchema)
}

// Full-text search across all table columns in the sales pipeline collection
export async function searchSalesPipeline(
  query: string,
  options: SalesPipelineSearchOptions = {}
): Promise<SalesPipelineSearchResult> {
  const {
    page = 1,
    perPage = 50,
    filterBy,
    sortBy,
    queryBy = SALES_PIPELINE_QUERY_BY_FIELDS,
    facetBy,
  } = options

  const cleanQuery = query.trim() || '*'

  const searchParams: SearchParams<any> = {
    q: cleanQuery,
    query_by: queryBy,
    page,
    per_page: perPage,
    prefix: true,
    num_typos: 2,
    typo_tokens_threshold: 1,
  }

  if (filterBy) searchParams.filter_by = filterBy
  if (sortBy) searchParams.sort_by = sortBy
  if (facetBy) searchParams.facet_by = facetBy

  const response = await searchCollection<SalesPipelineDocument>(
    SALES_PIPELINE_COLLECTION_NAME,
    searchParams
  )

  const hits = (response.hits || []).map((hit) => ({
    document: hit.document,
    highlight: hit.highlight,
    textMatch: hit.text_match,
  }))

  const matchedLeadIds = hits.map((h) => h.document.id).filter(Boolean)
  const found = response.found || 0

  return {
    hits,
    matchedLeadIds,
    found,
    page: response.page || page,
    totalPages: Math.ceil(found / perPage),
    searchTimeMs: response.search_time_ms || 0,
  }
}

// Maps and upserts Prisma Lead records into the sales pipeline Typesense collection
export async function upsertSalesPipelineLeads(leads: any[]): Promise<number> {
  if (!leads || leads.length === 0) return 0
  await ensureSalesPipelineCollection()
  const documents: SalesPipelineDocument[] = leads.map(mapLeadToSalesPipelineDocument)
  await upsertDocuments(SALES_PIPELINE_COLLECTION_NAME, documents)
  return documents.length
}

// Ensures the employee hierarchy collection exists in Typesense
export async function ensureEmployeeHierarchyCollection(): Promise<void> {
  await ensureCollection(employeeHierarchySchema)
}

// Drops and recreates the employee hierarchy collection
export async function resetEmployeeHierarchyCollection(): Promise<void> {
  const client = getTypesenseClient()
  await deleteCollection(EMPLOYEE_HIERARCHY_COLLECTION_NAME)
  await client.collections().create(employeeHierarchySchema)
}

// Upserts employee hierarchy documents into Typesense
export async function upsertEmployeeHierarchy(
  documents: EmployeeHierarchyDocument[]
): Promise<number> {
  if (documents.length === 0) return 0
  await ensureEmployeeHierarchyCollection()
  await upsertDocuments(EMPLOYEE_HIERARCHY_COLLECTION_NAME, documents)
  return documents.length
}

// Retrieves an employee's hierarchy mapping from Typesense in ~2ms
export async function getEmployeeHierarchyFromTypesense(
  userId: string
): Promise<EmployeeHierarchyDocument | null> {
  if (!isTypesenseConfigured() || !userId) return null
  try {
    const client = getTypesenseClient()
    const doc = await client
      .collections(EMPLOYEE_HIERARCHY_COLLECTION_NAME)
      .documents(userId)
      .retrieve()
    return (doc as unknown) as EmployeeHierarchyDocument
  } catch (err: any) {
    return null
  }
}

export const typesenseClient = getTypesenseClient()
export default typesenseClient

// Builds Typesense filter_by clause to enforce strict RBAC and sales team hierarchy
export async function buildTypesenseRoleFilter(
  user: { id: string; role: string },
  cachedScope?: { subordinateUserIds?: string[]; teamLeadId?: number | string | null }
): Promise<string | undefined> {
  if (user.role === 'ADMIN' || user.role === 'EXECUTIVE_ASSISTANT') {
    return undefined
  }

  if (user.role === 'BD') {
    return `bdId:=${user.id}`
  }

  if (
    user.role === 'TEAM_LEAD' ||
    user.role === 'ASSISTANT_CATEGORY_MANAGER' ||
    user.role === 'CATEGORY_MANAGER' ||
    user.role === 'SALES_HEAD'
  ) {
    let visibleUserIds = cachedScope?.subordinateUserIds
    let teamLeadId = cachedScope?.teamLeadId

    if (!visibleUserIds) {
      const tsHierarchy = await getEmployeeHierarchyFromTypesense(user.id)
      if (tsHierarchy && tsHierarchy.subordinateUserIds?.length > 0) {
        visibleUserIds = tsHierarchy.subordinateUserIds
        teamLeadId = tsHierarchy.teamLeadNumber
      } else {
        const employee = await getEmployeeByUserId(user.id)
        const subordinates = employee ? await getSubordinates(employee.id, true) : []
        visibleUserIds = [user.id, ...subordinates.map((s: { userId: string }) => s.userId)]
        teamLeadId = employee?.bdNumber
      }
    }

    const clauses: string[] = []
    if (visibleUserIds.length > 0) {
      clauses.push(`bdId:[${visibleUserIds.join(',')}]`)
    }
    if (teamLeadId) {
      clauses.push(`teamLeadId:=${teamLeadId}`)
    }

    if (clauses.length === 1) return clauses[0]
    if (clauses.length > 1) return `(${clauses.join(' || ')})`
    return undefined
  }

  return undefined
}

// Maps a Typesense SalesPipelineDocument directly into a client-safe pipeline lead object
export function mapTypesenseDocToPipelineLead(
  doc: SalesPipelineDocument,
  userRole?: string | null
) {
  const canViewPhone = userRole === 'ADMIN'
  const updatedDateIso = doc.updatedDate ? new Date(doc.updatedDate * 1000).toISOString() : null
  const latestRemarkObj = doc.latestRemark
    ? {
        id: doc.id,
        content: doc.latestRemark,
        createdAt: updatedDateIso || doc.createdDateStr || null,
        createdBy: null,
      }
    : null

  return {
    id: doc.id,
    leadRef: doc.leadRef || '',
    patientName: doc.patientName || '',
    phoneNumber: canViewPhone
      ? (doc.phoneNumber || null)
      : (doc.phoneNumber ? maskPhoneNumber(doc.phoneNumber) : null),
    alternateNumber: canViewPhone
      ? (doc.alternateNumber || null)
      : (doc.alternateNumber ? maskPhoneNumber(doc.alternateNumber) : null),
    whatsapp: canViewPhone
      ? (doc.whatsapp || null)
      : (doc.whatsapp ? maskPhoneNumber(doc.whatsapp) : null),
    age: doc.age ?? null,
    sex: doc.sex ?? null,
    treatment: doc.treatment ?? null,
    diseaseDetails: doc.planningTreatment ?? null,
    category: doc.category ?? null,
    status: doc.status || '',
    caseStage: doc.caseStage ?? null,
    pipelineStage: doc.pipelineStage ?? null,
    subStatus: doc.subStatus ?? null,
    bdId: doc.bdId ?? null,
    circle: doc.circle ?? null,
    campaignName: doc.campaignName ?? null,
    month: doc.month ?? null,
    assignedDate: doc.assignedDateStr ?? null,
    leadEntryDate: doc.leadEntryDateStr ?? null,
    createdDate: doc.createdDateStr ?? null,
    updatedDate: updatedDateIso ?? null,
    followUpDate: doc.followUpDateStr ?? null,
    surgeryDate: doc.surgeryDateStr ?? null,
    profession: doc.profession ?? null,
    teamLeadId: doc.teamLeadId ? Number(doc.teamLeadId) || null : null,
    duplCount: doc.duplCount ?? 0,
    source: doc.source ?? null,
    leadSource: doc.campaignSourceDisplay ?? null,
    insuranceName: doc.insuranceName ?? null,
    modeOfPayment: doc.mop ?? null,
    hospitalName: doc.hospitalName ?? null,
    doctorName: doc.doctorName ?? null,
    remarks: doc.remarks ?? null,
    latestRemark: latestRemarkObj,
    ipdPotentialDate: null,
    ipdDrName: null,
    surgeonName: doc.doctorName ?? null,
    updatedBy: doc.modifyBy ? { id: '', name: doc.modifyBy } : null,
    openedInCrmAt: null,
    removeRemarks: false,
    remarksClearedAt: null,
    removeFollowUpDate: false,
    followUpDateClearedAt: null,
    plRecord: doc.managerName ? { managerName: doc.managerName } : null,
    dischargeSheet: null,
    kypSubmission: null,
    bd: doc.bdName
      ? {
          id: doc.bdId || '',
          name: doc.bdName,
          role: 'BD',
          employee: doc.managerName
            ? {
                manager: {
                  user: {
                    name: doc.managerName,
                  },
                },
              }
            : null,
        }
      : null,
    admissionRecord: doc.surgeryDateStr ? { surgeryDate: doc.surgeryDateStr } : null,
  }
}

// Synchronizes a single lead from PostgreSQL to Typesense by ID (for instant real-time updates on lead edit)
export async function syncSingleLeadToTypesense(leadId: string): Promise<boolean> {
  if (!isTypesenseConfigured() || !leadId) return false
  try {
    const { prisma } = await import('@/lib/prisma')
    const { pipelineTableSelect } = await import('@/lib/pipeline/server-query')
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: pipelineTableSelect,
    })
    if (!lead) return false
    await upsertSalesPipelineLeads([lead])
    return true
  } catch (err) {
    console.warn('[Typesense] Failed to sync single lead to Typesense:', err)
    return false
  }
}

// Export all collection schemas, document interfaces, and mappers
export * from './schema'
export * from './query-parser'
