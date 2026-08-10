import { prisma } from '@/lib/prisma'

export type PatientLookupResult = {
  found: boolean
  type?: 'lead'
  leadId?: string | null
  leadRef?: string | null
  patientName?: string | null
  treatment?: string | null
  category?: string | null
  status?: string | null
  bdName?: string | null
}

function extractDigits(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.replace(/\D/g, '')
}

function extractLast10(raw: string | null | undefined): string {
  const digits = extractDigits(raw)
  if (digits.length >= 10) return digits.slice(-10)
  return digits
}

function isInvalidLookupPhone(last10: string) {
  return last10.length !== 10 || /^0+$/.test(last10)
}

export async function lookupPatientByPhone(rawPhone: string): Promise<PatientLookupResult> {
  const digits = extractDigits(rawPhone)
  const last10 = extractLast10(rawPhone)

  console.log(`\n=================== [TELEPHONY LOOKUP START] ===================`)
  console.log(`[TELEPHONY LOOKUP] Performing server-side lead lookup for rawPhone: "${rawPhone}"`)

  if (isInvalidLookupPhone(last10)) {
    console.log(`[TELEPHONY LOOKUP] Invalid phone digits. Returning found: false.`)
    console.log(`=================== [TELEPHONY LOOKUP END] ===================\n`)
    return { found: false }
  }

  const searchTokens = Array.from(
    new Set([last10, digits, rawPhone.trim(), last10.slice(-8), last10.slice(-6)])
  ).filter((token): token is string => Boolean(token && token.length >= 6))

  const leads = await prisma.lead.findMany({
    where: {
      OR: searchTokens.flatMap((token) => [
        { phoneNumber: { contains: token } },
        { alternateNumber: { contains: token } },
      ]),
    },
    select: {
      id: true,
      leadRef: true,
      patientName: true,
      phoneNumber: true,
      alternateNumber: true,
      category: true,
      treatment: true,
      status: true,
      createdDate: true,
      bd: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { createdDate: 'asc' }, // Pick the very first record if multiple exist
      { id: 'asc' },
    ],
    take: 20,
  })

  let matchedLead = leads.find((candidate) => {
    const p1 = extractLast10(candidate.phoneNumber)
    const p2 = extractLast10(candidate.alternateNumber)
    return p1 === last10 || p2 === last10
  })

  if (!matchedLead && leads.length > 0) {
    matchedLead = leads[0]
  }

  if (!matchedLead && last10.length >= 6) {
    try {
      const likePattern = `%${last10}%`
      const rawLeads = await prisma.$queryRaw<
        Array<{
          id: string
          leadRef: string
          patientName: string
          phoneNumber: string
          category: string | null
          treatment: string | null
          status: string
          bdName: string | null
        }>
      >`
        SELECT
          l.id,
          l."leadRef",
          l."patientName",
          l."phoneNumber",
          l.category,
          l.treatment,
          l.status,
          u.name as "bdName"
        FROM "Lead" l
        LEFT JOIN "User" u ON u.id = l."bdId"
        WHERE REGEXP_REPLACE(COALESCE(l."phoneNumber", ''), '\D', '', 'g') LIKE ${likePattern}
           OR REGEXP_REPLACE(COALESCE(l."alternateNumber", ''), '\D', '', 'g') LIKE ${likePattern}
        ORDER BY l."createdDate" ASC
        LIMIT 1
      `

      if (rawLeads.length > 0) {
        const lead = rawLeads[0]
        matchedLead = {
          id: lead.id,
          leadRef: lead.leadRef,
          patientName: lead.patientName,
          phoneNumber: lead.phoneNumber,
          alternateNumber: null,
          category: lead.category,
          treatment: lead.treatment,
          status: lead.status,
          createdDate: null as any,
          bd: lead.bdName ? { id: '', name: lead.bdName } : null,
        }
      }
    } catch {}
  }

  if (matchedLead) {
    const result: PatientLookupResult = {
      found: true,
      type: 'lead',
      leadId: matchedLead.id,
      leadRef: matchedLead.leadRef,
      patientName: matchedLead.patientName || 'Unknown Patient',
      treatment: matchedLead.treatment || 'N/A',
      category: matchedLead.category || 'N/A',
      status: matchedLead.status || 'NEW',
      bdName: matchedLead.bd?.name || null,
    }
    console.log(`[TELEPHONY LOOKUP RESULT] SUCCESS:`, result)
    console.log(`=================== [TELEPHONY LOOKUP END] ===================\n`)
    return result
  }

  console.log(`[TELEPHONY LOOKUP RESULT] NOT FOUND for input phone.`)
  console.log(`=================== [TELEPHONY LOOKUP END] ===================\n`)
  return { found: false }
}
