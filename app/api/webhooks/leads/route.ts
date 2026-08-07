import { NextResponse } from 'next/server'
import { normalizeLeadPhoneToLast10 } from '@/lib/lead-duplicates'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {}
    const rawPhone =
      record.Patient_Number ??
      record.phone ??
      record.phoneNumber ??
      record.mobile ??
      record.mobileNumber ??
      null

    // Store the raw payload
    const lead = await prisma.incomingLead.create({
      data: {
        source: 'external_api',
        payload: body,
        status: 'PENDING',
        normalizedPhone: rawPhone == null ? null : normalizeLeadPhoneToLast10(String(rawPhone)),
      },
    })

    return NextResponse.json({ success: true, id: lead.id })
  } catch (error) {
    console.error('Error processing lead webhook:', error)
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
