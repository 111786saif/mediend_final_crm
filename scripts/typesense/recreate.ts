// Single script to recreate and re-sync all Typesense collections from PostgreSQL
// Handles multiple schemas (sales-pipeline, employee-hierarchy) in one place
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import {
  getTypesenseClient,
  isTypesenseConfigured,
  deleteCollection,
  upsertEmployeeHierarchy,
} from '@/lib/typesense/client'
import {
  ALL_TYPESENSE_SCHEMAS,
  SALES_PIPELINE_COLLECTION_NAME,
  mapLeadToSalesPipelineDocument,
  type EmployeeHierarchyDocument,
} from '@/lib/typesense/schema'
import { getSubordinates } from '@/lib/hierarchy'
import { pipelineTableSelect } from '@/lib/pipeline/server-query'

async function recreateAllCollections() {
  console.log('[Typesense] Starting complete recreation and sync across all schemas...')

  if (!isTypesenseConfigured()) {
    console.error('[Typesense] Error: Typesense is not configured in .env')
    process.exit(1)
  }

  const client = getTypesenseClient()
  try {
    const health = await client.health.retrieve()
    console.log('[Typesense] Connected successfully:', health)
  } catch (err) {
    console.error('[Typesense] Health check failed:', err)
    process.exit(1)
  }

  // 1. Drop and recreate fresh empty schemas for all registered collections
  for (const [name, schema] of Object.entries(ALL_TYPESENSE_SCHEMAS)) {
    console.log(`[Typesense] Recreating schema for collection "${name}"...`)
    await deleteCollection(name)
    await client.collections().create(schema)
    console.log(`[Typesense] Collection "${name}" created with fresh empty schema.`)
  }

  // 2. Sync employee-hierarchy collection
  console.log('[Typesense] Syncing employee hierarchy...')
  const employees = await prisma.employee.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  })

  const hierarchyDocs: EmployeeHierarchyDocument[] = []
  const nowUnix = Math.floor(Date.now() / 1000)

  for (const emp of employees) {
    if (!emp.user) continue
    const subordinates = await getSubordinates(emp.id, true)
    const subordinateUserIds = Array.from(
      new Set([emp.userId, ...subordinates.map((s) => s.userId).filter(Boolean)])
    )

    hierarchyDocs.push({
      id: emp.userId,
      userId: emp.userId,
      employeeId: emp.id,
      name: emp.user.name || '',
      role: emp.user.role || '',
      teamLeadNumber: emp.bdNumber ? String(emp.bdNumber) : undefined,
      subordinateUserIds,
      updatedAt: nowUnix,
    })
  }

  const syncedEmployees = await upsertEmployeeHierarchy(hierarchyDocs)
  console.log(`[Typesense] Synced ${syncedEmployees} employee hierarchy documents.`)

  // 3. Sync sales-pipeline collection
  console.log('[Typesense] Syncing sales pipeline leads from PostgreSQL...')
  const totalLeads = await prisma.lead.count()
  console.log(`[Typesense] Found ${totalLeads.toLocaleString()} total leads in database.`)

  const batchSize = 500
  let skip = 0
  let totalIndexed = 0
  const startTime = Date.now()

  while (skip < totalLeads) {
    const take = Math.min(batchSize, totalLeads - skip)
    const leads = await prisma.lead.findMany({
      select: pipelineTableSelect,
      orderBy: { createdDate: 'desc' },
      skip,
      take,
    })

    if (leads.length === 0) break

    const documents = leads.map(mapLeadToSalesPipelineDocument)
    const importResults = await client
      .collections(SALES_PIPELINE_COLLECTION_NAME)
      .documents()
      .import(documents, { action: 'upsert' })

    const failed = (importResults as any[]).filter((r) => !r.success)
    totalIndexed += documents.length - failed.length
    skip += take

    const progressPct = ((skip / totalLeads) * 100).toFixed(1)
    console.log(`[Typesense] Indexed ${skip.toLocaleString()} / ${totalLeads.toLocaleString()} leads (${progressPct}%)...`)
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[Typesense] Recreation complete! Synced ${totalIndexed.toLocaleString()} leads in ${durationSec}s.`)
  process.exit(0)
}

recreateAllCollections()
  .catch((err) => {
    console.error('[Typesense] Recreate failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
