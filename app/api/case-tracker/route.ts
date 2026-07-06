import { NextRequest } from 'next/server'
import { GET as getLeads } from '@/app/api/leads/route'
import { filterLeadsByCaseTrackerDateRange } from '@/lib/case-tracker-date-range'
import { errorResponse, successResponse } from '@/lib/api-utils'
import type { Lead } from '@/hooks/use-leads'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const leadsUrl = new URL(request.url)
    leadsUrl.pathname = '/api/leads'
    leadsUrl.searchParams.set('view', 'pipeline')
    leadsUrl.searchParams.delete('fromDate')
    leadsUrl.searchParams.delete('toDate')

    const leadsRequest = new NextRequest(leadsUrl, {
      headers: request.headers,
      method: 'GET',
    })

    const leadsResponse = await getLeads(leadsRequest)
    const payload = (await leadsResponse.json()) as {
      success: boolean
      data?: Lead[]
      error?: string
    }

    if (!payload.success) {
      return Response.json(payload, { status: leadsResponse.status })
    }

    let leads = payload.data ?? []

    if (fromDate || toDate) {
      leads = filterLeadsByCaseTrackerDateRange(leads, fromDate, toDate)
    }

    return successResponse(leads)
  } catch (error) {
    console.error('Error fetching case tracker leads:', error)
    return errorResponse('Failed to fetch case tracker leads', 500)
  }
}
