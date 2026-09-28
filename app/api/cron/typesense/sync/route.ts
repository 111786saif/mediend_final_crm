import { NextRequest, NextResponse } from 'next/server'
import { isTypesenseConfigured } from '@/lib/typesense/client'
import { syncLeadsToTypesense } from '@/lib/typesense/sync'

/**
 * Cron endpoint for incremental Typesense sync
 * Called by external cron services (e.g. cron-job.org, curl, AWS EventBridge)
 * Configured with timing from environment or external schedule (every 5 minutes by default)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.CRON_SECRET

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isTypesenseConfigured()) {
      return NextResponse.json(
        { success: false, message: 'Typesense is not configured in .env' },
        { status: 200 }
      )
    }

    const result = await syncLeadsToTypesense()

    return NextResponse.json({
      success: result.success,
      synced: result.synced,
      totalFound: result.totalFound,
      durationMs: result.durationMs,
      since: result.since,
      error: result.error,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal server error during Typesense sync',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
