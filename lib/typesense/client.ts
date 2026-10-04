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
  const apiKey = (process.env.TYPESENSE_API_KEY || '').trim()
  const fullUrl = (process.env.TYPESENSE_URL || process.env.TYPESENSE_ENDPOINT || '').trim()
  const timeoutSeconds = Number(process.env.TYPESENSE_CONNECTION_TIMEOUT_SECONDS) || 3

  const hasValidApiKey = Boolean(apiKey && apiKey !== 'xyz_typesense_api_key')

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
        isConfigured: Boolean(hasValidApiKey && host),
      }
    } catch (e) {
      console.warn('[Typesense] Invalid TYPESENSE_URL provided, falling back to host/port variables:', e)
    }
  }

  const explicitHost = (process.env.TYPESENSE_HOST || '').trim()
  const hasExplicitHost = Boolean(explicitHost)
  const host = explicitHost || 'localhost'
  const port = Number(process.env.TYPESENSE_PORT) || 8108
  const protocol = process.env.TYPESENSE_PROTOCOL || 'http'

  return {
    nodes: [{ host, port, protocol, path: '' }],
    apiKey,
    connectionTimeoutSeconds: timeoutSeconds,
    // Only configured if both an explicit valid API key and explicit host/URL are in .env
    isConfigured: Boolean(hasValidApiKey && hasExplicitHost),
  }
}

// Threshold of consecutive 502 Bad Gateway / connectivity errors before circuit trips
export const TYPESENSE_502_FAILURE_THRESHOLD = 3

interface TypesenseCircuitState {
  count502: number
  isCircuitBroken: boolean
  lastFailureAt: number | null
  lastFailureMessage: string | null
}

const globalForTypesense = globalThis as unknown as {
  __typesenseCircuitState?: TypesenseCircuitState
}

function getCircuitState(): TypesenseCircuitState {
  if (!globalForTypesense.__typesenseCircuitState) {
    globalForTypesense.__typesenseCircuitState = {
      count502: 0,
      isCircuitBroken: false,
      lastFailureAt: null,
      lastFailureMessage: null,
    }
  }
  return globalForTypesense.__typesenseCircuitState
}

// In-memory counter for 502 / connectivity errors
export function getTypesense502Count(): number {
  return getCircuitState().count502
}

// Checks if the 502 circuit breaker has tripped (multiple 502 errors detected)
export function isTypesenseCircuitBroken(): boolean {
  return getCircuitState().isCircuitBroken
}

// Determines if an error represents 502 Bad Gateway, 503, 504, or network connection failure
export function isTypesenseUnavailableError(err: any): boolean {
  if (!err) return false

  const status = err.httpStatus ?? err.status ?? err.statusCode ?? err.response?.status
  if (status === 502 || status === 503 || status === 504) return true

  const msg = String(err.message || err.toString() || '').toLowerCase()
  return (
    msg.includes('502') ||
    msg.includes('bad gateway') ||
    msg.includes('503') ||
    msg.includes('service unavailable') ||
    msg.includes('504') ||
    msg.includes('gateway timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('connection refused') ||
    msg.includes('connect timeout') ||
    msg.includes('fetch failed')
  )
}

// Records a 502 Bad Gateway / connectivity error. When count reaches threshold (2-3 times),
// trips the circuit and disables Typesense until server restart.
export function recordTypesense502Error(err?: any): void {
  const state = getCircuitState()
  state.count502 += 1
  state.lastFailureAt = Date.now()
  state.lastFailureMessage = err?.message || String(err || '502 Bad Gateway')

  console.warn(
    `[Typesense] 502 / unreachable error count: ${state.count502}/${TYPESENSE_502_FAILURE_THRESHOLD}. Details:`,
    state.lastFailureMessage
  )

  if (state.count502 >= TYPESENSE_502_FAILURE_THRESHOLD) {
    state.isCircuitBroken = true
    console.error(
      `[Typesense Circuit Breaker] Typesense encountered 502 / unavailable ${state.count502} times. Circuit tripped! Stopping all Typesense queries and falling back directly to PostgreSQL until server restart.`
    )
  }
}

// Resets the circuit breaker and 502 error counter (e.g. on server restart or manual re-enable)
export function resetTypesenseCircuit(): void {
  const state = getCircuitState()
  state.count502 = 0
  state.isCircuitBroken = false
  state.lastFailureAt = null
  state.lastFailureMessage = null
}

// Checks if Typesense is properly configured with an API key and host in .env,
// and that the in-memory 502 circuit breaker has not tripped
export function isTypesenseConfigured(options?: { checkCircuit?: boolean }): boolean {
  const checkCircuit = options?.checkCircuit ?? true
  if (checkCircuit && isTypesenseCircuitBroken()) {
    return false
  }
  return getTypesenseConfig().isConfigured
}

// Convenience helper to explicitly check if Typesense is both configured and available
export function isTypesenseAvailable(): boolean {
  return isTypesenseConfigured({ checkCircuit: true })
}

let cachedClient: Client | null = null

// Returns the cached singleton instance of Typesense client
export function getTypesenseClient(): Client {
  if (cachedClient) return cachedClient

  const config = getTypesenseConfig()

  // Use a fast timeout (max 2 seconds) and 1 retry to fail fast on 502s rather than hanging requests
  const timeout = Math.min(2, Math.max(1, config.connectionTimeoutSeconds))

  cachedClient = new Client({
    nodes: config.nodes,
    apiKey: config.apiKey,
    connectionTimeoutSeconds: timeout,
    retryIntervalSeconds: 0.2,
    numRetries: 1,
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
      if (isTypesenseCircuitBroken()) {
        return {
          ok: false,
          message: `Typesense is temporarily disabled in-memory after ${getTypesense502Count()} 502 errors. Database fallback active.`,
        }
      }
      return { ok: false, message: 'Typesense is not configured in .env' }
    }
    const client = getTypesenseClient()
    const health = await client.health.retrieve()
    return { ok: health.ok, message: health.ok ? 'Typesense server is healthy' : 'Typesense returned unhealthy' }
  } catch (error: any) {
    if (isTypesenseUnavailableError(error)) {
      recordTypesense502Error(error)
    }
    return { ok: false, message: error?.message || 'Failed to connect to Typesense server' }
  }
}

// Creates a collection if it does not already exist, or updates fields if schema changed
export async function ensureCollection(schema: CollectionCreateSchema): Promise<void> {
  const client = getTypesenseClient()
  try {
    await client.collections(schema.name).retrieve()
    // Auto-patch schema fields if new fields were added to schema definition
    if (schema.fields) {
      await client.collections(schema.name).update({ fields: schema.fields as any }).catch(() => {})
    }
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
  if (isTypesenseCircuitBroken()) {
    console.warn('[Typesense] Skipping upsertDocuments because 502 circuit breaker is active')
    return []
  }
  const client = getTypesenseClient()
  try {
    return await client.collections(collectionName).documents().import(documents, { action: 'upsert' })
  } catch (err: any) {
    if (isTypesenseUnavailableError(err)) {
      recordTypesense502Error(err)
    }
    throw err
  }
}

// Executes a search query on a given collection
export async function searchCollection<T extends Record<string, any>>(
  collectionName: string,
  searchParameters: SearchParams<any>
) {
  if (isTypesenseCircuitBroken()) {
    throw new Error('Typesense unavailable: 502 circuit breaker is active')
  }
  const client = getTypesenseClient()
  try {
    return await client.collections<T>(collectionName).documents().search(searchParameters)
  } catch (err: any) {
    if (isTypesenseUnavailableError(err)) {
      recordTypesense502Error(err)
    }
    throw err
  }
}

// Parameters for searching the sales pipeline collection
export interface SalesPipelineSearchOptions {
  page?: number
  perPage?: number
  filterBy?: string
  sortBy?: string
  queryBy?: string
  facetBy?: string
  maxFacetValues?: number
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
  matchedLeadRefs: string[]
  found: number
  page: number
  totalPages: number
  searchTimeMs: number
  facetCounts?: Array<{
    counts: Array<{ count: number; highlighted: string; value: string }>
    field_name: string
    stats?: Record<string, any>
  }>
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
    maxFacetValues = 100,
  } = options

  const cleanQuery = query.trim() || '*'

  const searchParams: SearchParams<any> = {
    q: cleanQuery,
    query_by: queryBy,
    page,
    per_page: perPage,
    prefix: cleanQuery !== '*',
    num_typos: cleanQuery !== '*' ? 2 : 0,
    typo_tokens_threshold: 1,
  }

  if (filterBy) searchParams.filter_by = filterBy
  if (sortBy) searchParams.sort_by = sortBy
  if (facetBy) {
    searchParams.facet_by = facetBy
    searchParams.max_facet_values = maxFacetValues
  }

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
  const matchedLeadRefs = hits.map((h) => h.document.leadRef).filter(Boolean)
  const found = response.found || 0

  return {
    hits,
    matchedLeadIds,
    matchedLeadRefs,
    found,
    page: response.page || page,
    totalPages: Math.ceil(found / perPage),
    searchTimeMs: response.search_time_ms || 0,
    facetCounts: (response as any).facet_counts,
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
    if (isTypesenseUnavailableError(err)) {
      recordTypesense502Error(err)
    }
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
  const role = user.role
  if (
    role === 'ADMIN' ||
    role === 'SUPER_ADMIN' ||
    role === 'EXECUTIVE_ASSISTANT' ||
    role === 'SALES_HEAD' ||
    role === 'MD'
  ) {
    return undefined
  }

  if (role === 'BD') {
    return `bdId:=${user.id}`
  }

  if (
    role === 'TEAM_LEAD' ||
    role === 'ASSISTANT_CATEGORY_MANAGER' ||
    role === 'CATEGORY_MANAGER'
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
  const resolveIsoDate = (isoStr?: string | null, unixSecs?: number | null) => {
    if (isoStr && isoStr.includes('T')) return isoStr
    if (unixSecs) return new Date(unixSecs * 1000).toISOString()
    if (isoStr) return isoStr
    return null
  }

  const updatedDateIso = resolveIsoDate(null, doc.updatedDate)
  const latestRemarkObj = doc.latestRemark
    ? {
        id: doc.id,
        content: doc.latestRemark,
        createdAt: updatedDateIso || resolveIsoDate(doc.createdDateStr, doc.createdDate) || null,
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
    planningTreatment: doc.planningTreatment ?? null,
    category: doc.category ?? null,
    status: doc.status || '',
    caseStage: doc.caseStage ?? null,
    pipelineStage: doc.pipelineStage ?? null,
    subStatus: doc.subStatus ?? null,
    bdId: doc.bdId ?? null,
    circle: doc.circle ?? null,
    city: doc.city ?? null,
    preferredLocation: doc.preferredLocation ?? null,
    flowType: doc.flowType ?? null,
    campaignName: doc.campaignName ?? null,
    month: doc.month ?? null,
    assignedDate: resolveIsoDate(doc.assignedDateStr, doc.assignedDate),
    leadEntryDate: resolveIsoDate(doc.leadEntryDateStr, doc.leadEntryDate),
    createdDate: resolveIsoDate(doc.createdDateStr, doc.createdDate),
    updatedDate: updatedDateIso ?? null,
    followUpDate: resolveIsoDate(doc.followUpDateStr, doc.followUpDate),
    surgeryDate: resolveIsoDate(doc.surgeryDateStr, doc.surgeryDate),
    profession: doc.profession ?? null,
    teamLeadId: doc.teamLeadId ? Number(doc.teamLeadId) || null : null,
    duplCount: doc.duplCount ?? 0,
    source: doc.source ?? null,
    leadSource: doc.campaignSourceDisplay ?? null,
    insuranceName: doc.insuranceName ?? null,
    healthInsurance: doc.insuranceName ?? null,
    modeOfPayment: doc.mop ?? null,
    hospitalName: doc.hospitalName ?? null,
    doctorName: doc.doctorName ?? null,
    remarks: doc.remarks ?? null,
    latestRemark: latestRemarkObj,
    ipdPotentialDate: resolveIsoDate(doc.ipdPotentialDateStr, doc.ipdPotentialDate),
    ipdDrName: doc.ipdDrName ?? null,
    surgeonName: doc.doctorName ?? null,
    updatedBy: doc.modifyBy ? { id: '', name: doc.modifyBy } : null,
    openedInCrmAt: resolveIsoDate(doc.openedInCrmAtStr, doc.openedInCrmAt),
    removeRemarks: doc.removeRemarks ?? false,
    remarksClearedAt: resolveIsoDate(doc.remarksClearedAtStr, doc.remarksClearedAt),
    removeFollowUpDate: doc.removeFollowUpDate ?? false,
    followUpDateClearedAt: resolveIsoDate(doc.followUpDateClearedAtStr, doc.followUpDateClearedAt),
    plRecord: {
      bdmName: doc.bdName || null,
      managerName: doc.managerName || null,
      doctorName: doc.doctorName || null,
      hospitalName: doc.hospitalName || null,
    },
    dischargeSheet: {
      doctorName: doc.doctorName || null,
      hospitalName: doc.hospitalName || null,
    },
    kypSubmission: doc.preferredLocation || doc.city
      ? {
          location: doc.preferredLocation || doc.city || null,
          preAuthData: null,
        }
      : null,
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

// Deletes a single lead document from Typesense by ID
export async function deleteSingleLeadFromTypesense(leadId: string | number): Promise<boolean> {
  if (!isTypesenseConfigured() || !leadId) return false
  try {
    const client = getTypesenseClient()
    await client.collections(SALES_PIPELINE_COLLECTION_NAME).documents(String(leadId)).delete()
    return true
  } catch (err: any) {
    if (err?.httpStatus === 404) return true // Already deleted
    console.warn('[Typesense] Failed to delete lead from Typesense:', err)
    return false
  }
}

// Synchronizes a single lead from PostgreSQL to Typesense by ID or in-memory lead object (for instant real-time updates on lead edit/create)
export async function syncSingleLeadToTypesense(leadOrId: string | Record<string, any>): Promise<boolean> {
  if (!isTypesenseConfigured() || !leadOrId) return false
  try {
    let lead: any = null
    if (typeof leadOrId === 'object' && leadOrId !== null && leadOrId.id) {
      // In-memory lead object provided directly — eliminates extra PostgreSQL query roundtrip
      lead = leadOrId
    } else {
      const { prisma } = await import('@/lib/prisma')
      const { pipelineTableSelect } = await import('@/lib/pipeline/server-query')
      lead = await prisma.lead.findUnique({
        where: { id: String(leadOrId) },
        select: pipelineTableSelect,
      })
    }
    if (!lead) {
      // If lead was deleted from PostgreSQL, remove it from Typesense as well
      if (typeof leadOrId === 'string' || typeof leadOrId === 'number') {
        await deleteSingleLeadFromTypesense(String(leadOrId))
      }
      return false
    }
    await upsertSalesPipelineLeads([lead])
    return true
  } catch (err) {
    console.warn('[Typesense] Failed to sync single lead to Typesense:', err)
    return false
  }
}

// Synchronizes multiple leads from PostgreSQL to Typesense by IDs (for batch updates e.g. bulk reassignment)
export async function syncMultipleLeadsToTypesense(leadIds: string[]): Promise<boolean> {
  if (!isTypesenseConfigured() || !leadIds || leadIds.length === 0) return false
  try {
    const { prisma } = await import('@/lib/prisma')
    const { pipelineTableSelect } = await import('@/lib/pipeline/server-query')
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: pipelineTableSelect,
    })
    if (!leads || leads.length === 0) return false
    await upsertSalesPipelineLeads(leads)
    return true
  } catch (err) {
    console.warn('[Typesense] Failed to sync multiple leads to Typesense:', err)
    return false
  }
}

// Export all collection schemas, document interfaces, and mappers
export * from './schema'
export * from './query-parser'
