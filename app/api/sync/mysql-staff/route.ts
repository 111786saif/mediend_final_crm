import { NextRequest } from 'next/server'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { syncStaffFromMySQL } from '@/lib/sync/mysql-staff-sync'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()

    // Only allow admins, sales heads, or MD to trigger staff sync
    if (
      user.role !== 'ADMIN' && 
      user.role !== 'MD' && 
      user.role !== 'SALES_HEAD'
    ) {
      return errorResponse('Insufficient permissions', 403)
    }

    const result = await syncStaffFromMySQL()

    return successResponse({
      message: 'Staff sync completed successfully',
      ...result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Staff sync API error:', error)
    return errorResponse('Failed to sync staff from MySQL', 500)
  }
}

export async function GET(request: NextRequest) {
  // GET just returns status - doesn't run the sync (to avoid accidental triggers)
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()

    if (
      user.role !== 'ADMIN' && 
      user.role !== 'MD' && 
      user.role !== 'SALES_HEAD'
    ) {
      return errorResponse('Insufficient permissions', 403)
    }

    const syncState = await prisma.syncState.findUnique({
      where: { sourceType: 'mysql_staff' }
    })

    return successResponse({
      lastSynced: syncState?.lastRunAt,
      recordsProcessed: syncState?.recordsCount || 0,
      message: 'Staff sync endpoint is available. Use POST to trigger sync.'
    })

  } catch (error) {
    return errorResponse('Failed to check sync status', 500)
  }
}
