import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface MediendDB extends DBSchema {
  leads: {
    key: string
    value: {
      key: string
      data: unknown
      timestamp: number
    }
    indexes: { 'by-timestamp': number }
  }
  analytics: {
    key: string
    value: {
      key: string
      data: unknown
      timestamp: number
    }
    indexes: { 'by-timestamp': number }
  }
  filters: {
    key: string
    value: {
      key: string
      data: unknown
      timestamp: number
    }
  }
}

let dbInstance: IDBPDatabase<MediendDB> | null = null

export async function getDB(): Promise<IDBPDatabase<MediendDB>> {
  if (dbInstance) {
    return dbInstance
  }

  dbInstance = await openDB<MediendDB>('mediend-crm', 1, {
    upgrade(db) {
      // Leads store
      if (!db.objectStoreNames.contains('leads')) {
        const leadsStore = db.createObjectStore('leads', { keyPath: 'key' })
        leadsStore.createIndex('by-timestamp', 'timestamp')
      }

      // Analytics store
      if (!db.objectStoreNames.contains('analytics')) {
        const analyticsStore = db.createObjectStore('analytics', { keyPath: 'key' })
        analyticsStore.createIndex('by-timestamp', 'timestamp')
      }

      // Filters store
      if (!db.objectStoreNames.contains('filters')) {
        db.createObjectStore('filters', { keyPath: 'key' })
      }
    },
  })

  return dbInstance
}

export async function cacheLeads<T>(key: string, data: T): Promise<void> {
  const db = await getDB()
  await db.put('leads', {
    key,
    data,
    timestamp: Date.now(),
  })
}

export async function getCachedLeads<T>(key: string): Promise<T | null> {
  const db = await getDB()
  const cached = await db.get('leads', key)
  if (!cached) return null

  // Cache expires after 15 minutes
  const CACHE_TTL = 15 * 60 * 1000
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    await db.delete('leads', key)
    return null
  }

  return cached.data as T
}

export async function cacheAnalytics<T>(key: string, data: T): Promise<void> {
  const db = await getDB()
  await db.put('analytics', {
    key,
    data,
    timestamp: Date.now(),
  })
}

export async function getCachedAnalytics<T>(key: string): Promise<T | null> {
  const db = await getDB()
  const cached = await db.get('analytics', key)
  if (!cached) return null

  // Cache expires after 10 minutes
  const CACHE_TTL = 10 * 60 * 1000
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    await db.delete('analytics', key)
    return null
  }

  return cached.data as T
}

export async function saveFilters<T>(key: string, filters: T): Promise<void> {
  const db = await getDB()
  await db.put('filters', {
    key,
    data: filters,
    timestamp: Date.now(),
  })
}

export async function getFilters<T>(key: string): Promise<T | null> {
  const db = await getDB()
  const cached = await db.get('filters', key)
  return (cached?.data as T) || null
}

export async function clearCache(): Promise<void> {
  const db = await getDB()
  await db.clear('leads')
  await db.clear('analytics')
}

