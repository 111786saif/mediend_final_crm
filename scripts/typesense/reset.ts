// Single script to reset and drop all Typesense collections
// Handles multiple schemas (sales-pipeline, employee-hierarchy) in one place
import 'dotenv/config'
import {
  getTypesenseClient,
  isTypesenseConfigured,
  deleteCollection,
} from '@/lib/typesense/client'
import { ALL_TYPESENSE_SCHEMAS } from '@/lib/typesense/schema'

async function resetAllCollections() {
  console.log('[Typesense] Starting collection reset...')

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

  // Iterate through all registered schemas and delete each collection
  for (const name of Object.keys(ALL_TYPESENSE_SCHEMAS)) {
    console.log(`[Typesense] Dropping collection "${name}"...`)
    await deleteCollection(name)
    console.log(`[Typesense] Collection "${name}" dropped.`)
  }

  console.log('[Typesense] All collections reset successfully.')
  process.exit(0)
}

resetAllCollections().catch((err) => {
  console.error('[Typesense] Reset failed:', err)
  process.exit(1)
})
