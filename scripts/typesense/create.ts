// Single script to create and ensure all Typesense collection schemas
// Handles multiple schemas (sales-pipeline, employee-hierarchy) in one place
import 'dotenv/config'
import {
  getTypesenseClient,
  isTypesenseConfigured,
  ensureCollection,
} from '@/lib/typesense/client'
import { ALL_TYPESENSE_SCHEMAS } from '@/lib/typesense/schema'

async function createAllCollections() {
  console.log('[Typesense] Starting collection schema creation...')

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

  // Iterate through all registered schemas and ensure they exist
  for (const [name, schema] of Object.entries(ALL_TYPESENSE_SCHEMAS)) {
    console.log(`[Typesense] Ensuring schema for "${name}" exists...`)
    await ensureCollection(schema)
    console.log(`[Typesense] Collection "${name}" is ready.`)
  }

  console.log('[Typesense] All collections created successfully.')
  process.exit(0)
}

createAllCollections().catch((err) => {
  console.error('[Typesense] Create failed:', err)
  process.exit(1)
})
