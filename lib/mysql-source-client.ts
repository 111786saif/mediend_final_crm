import mysql from 'mysql2/promise'
import 'dotenv/config'

let pool: mysql.Pool | null = null
let leadColumnCache: Set<string> | null = null

/**
 * Get or create MySQL connection pool
 */
export function getMySQLPool(): mysql.Pool {
  if (!pool) {
    const connectionUrl = process.env.MYSQL_SOURCE_URL
    
    if (!connectionUrl) {
      throw new Error('MYSQL_SOURCE_URL environment variable is not set')
    }

    // Parse connection URL: mysql://user:password@host:port/database
    // Handle URL encoding and special characters in password
    let user: string
    let password: string
    let host: string
    let port: number
    let database: string

    try {
      // Try using URL class first (handles URL encoding)
      const url = new URL(connectionUrl.replace(/^mysql:/, 'http:'))
      user = decodeURIComponent(url.username)
      password = decodeURIComponent(url.password)
      host = url.hostname
      port = url.port ? parseInt(url.port, 10) : 3306
      database = url.pathname.replace(/^\//, '').split('?')[0] // Remove leading / and query params
    } catch (urlError) {
      // Fallback to regex parsing if URL class fails
      // More flexible regex that handles special characters
      const urlPattern = /^mysql:\/\/([^:@]+)(?::([^@]+))?@([^:/]+)(?::(\d+))?\/([^?]+)/
      const match = connectionUrl.match(urlPattern)
      
      if (!match) {
        throw new Error(
          'Invalid MYSQL_SOURCE_URL format. Expected: mysql://user:password@host:port/database\n' +
          `Received: ${connectionUrl.substring(0, 50)}...`
        )
      }

      user = decodeURIComponent(match[1] || '')
      password = match[2] ? decodeURIComponent(match[2]) : ''
      host = match[3] || 'localhost'
      port = match[4] ? parseInt(match[4], 10) : 3306
      database = match[5] ? decodeURIComponent(match[5]) : ''
    }

    if (!user || !host || !database) {
      throw new Error(
        'Invalid MYSQL_SOURCE_URL: missing required components (user, host, or database)'
      )
    }

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    })
  }

  return pool
}

/**
 * Execute a query on the MySQL database
 */
export async function queryMySQL<T = any>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  const pool = getMySQLPool()
  const [rows] = await pool.execute(sql, params || [])
  return rows as T[]
}

/**
 * Close the MySQL connection pool
 */
export async function closeMySQLPool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    leadColumnCache = null
  }
}

/**
 * Return lower-cased column names for the MySQL `lead` table.
 */
export async function getMySQLLeadColumns(): Promise<Set<string>> {
  if (leadColumnCache) {
    return leadColumnCache
  }

  const rows = await queryMySQL<{ COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'lead'`
  )

  leadColumnCache = new Set(rows.map((row) => row.COLUMN_NAME.toLowerCase()))
  return leadColumnCache
}

/**
 * Test MySQL connection
 */
export async function testMySQLConnection(): Promise<boolean> {
  try {
    await queryMySQL('SELECT 1 as test')
    return true
  } catch (error) {
    console.error('MySQL connection test failed:', error)
    return false
  }
}
