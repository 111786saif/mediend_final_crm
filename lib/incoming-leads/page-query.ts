import { Prisma } from '@/generated/prisma/client'
import { z } from 'zod'
import { mapCircleCode } from '@/lib/mysql-code-mappings'
import { parsePhoneSearchQuery } from '@/lib/phone-search'

const fields = ['id', 'receivedAt', 'processedAt', 'status', 'source', 'externalCampaignId',
  'payloadCampaignId', 'campaignName', 'campaignSource', 'leadSource', 'category', 'treatment',
  'circle', 'city', 'patientName', 'email', 'normalizedPhone', 'alternatePhone', 'whatsapp',
  'assignedDate', 'leadDate', 'followUpDate', 'surgeryDate', 'processedLeadRef',
  'processedLeadPatientName', 'processedLeadPhoneNumber', 'teamLeadName', 'teamLeadEmail',
  'bdName', 'bdEmail', 'errorMessage'] as const
const dateFields = new Set(['receivedAt', 'processedAt', 'assignedDate', 'leadDate', 'followUpDate', 'surgeryDate'])
const masterFields = new Set(['campaignSource', 'leadSource', 'category', 'treatment', 'circle', 'city'])
const fieldSchema = z.enum(fields)
const filterSchema = z.object({
  field: fieldSchema,
  type: z.enum(['multiSelect', 'search', 'dateRange']),
  value: z.union([z.string().max(500), z.array(z.string().max(500)).max(200)]),
})

export const incomingLeadPageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000000).default(1),
  pageSize: z.coerce.number().refine((value) => [20, 50, 100, 200].includes(value)).default(20),
  sortBy: fieldSchema.default('receivedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  searchColumn: fieldSchema.default('patientName'),
  searchValue: z.string().max(500).default(''),
  filters: z.array(filterSchema).max(100).default([]),
})

export function parseIncomingLeadPage(search: URLSearchParams) {
  return incomingLeadPageSchema.parse({
    ...Object.fromEntries(search),
    filters: search.has('filters') ? JSON.parse(search.get('filters')!) : [],
  })
}

// All identifiers below come from this allowlist. Values are bound parameters.
const col = (field: string) => Prisma.raw(`r."${field}"`)
const text = (field: string) => Prisma.sql`COALESCE(${col(field)}::text, '—')`
const payloadValue = (keys: string[]) => Prisma.sql`NULLIF(BTRIM(COALESCE(${Prisma.join(keys.map(key => Prisma.sql`p.body ->> ${key}`))})), '')`
const date = (field: string) => field === 'leadDate'
  ? Prisma.sql`substring(${col(field)}::text from '^([0-9]{4}-[0-9]{2}-[0-9]{2})')`
  : Prisma.sql`to_char(${col(field)} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`

export function incomingLeadPageQuery(
  params: z.infer<typeof incomingLeadPageSchema>,
  scopeUserIds: string[] | null,
  dateRange: { start: Date; end: Date } | null,
  canViewPhone = false,
) {
  const phoneFields = new Set(['normalizedPhone', 'alternatePhone', 'whatsapp', 'processedLeadPhoneNumber'])
  const displayText = (field: string) => !canViewPhone && phoneFields.has(field)
    ? Prisma.sql`COALESCE(repeat('x', GREATEST(length(NULLIF(btrim(${col(field)}), '')) - 4, 0)) || right(NULLIF(btrim(${col(field)}), ''), 4), '-')`
    : text(field)
  const phoneSearch = ['normalizedPhone', 'alternatePhone', 'whatsapp'].includes(params.searchColumn)
    ? parsePhoneSearchQuery(params.searchValue) : null
  const baseConditions: Prisma.Sql[] = []
  if (dateRange) baseConditions.push(Prisma.sql`i."receivedAt" >= ${dateRange.start} AND i."receivedAt" <= ${dateRange.end}`)
  // Preserve the existing explicit-phone recovery permission for unassigned leads.
  if (scopeUserIds !== null && !phoneSearch) {
    baseConditions.push(scopeUserIds.length === 0 ? Prisma.sql`FALSE` : Prisma.sql`(
      l."bdId" IN (${Prisma.join(scopeUserIds)}) OR i."selectedBdUserId" IN (${Prisma.join(scopeUserIds)})
      OR i."selectedTeamLeadUserId" IN (${Prisma.join(scopeUserIds)}))`)
  }
  const conditions: Prisma.Sql[] = []
  for (const filter of params.filters) {
    if (filter.type === 'multiSelect' && Array.isArray(filter.value) && filter.value.length) {
      conditions.push(Prisma.sql`${displayText(filter.field)} IN (${Prisma.join(filter.value)})`)
    } else if (filter.type === 'search' && typeof filter.value === 'string' && filter.value.trim()) {
      conditions.push(Prisma.sql`strpos(lower(${displayText(filter.field)}), lower(${filter.value.trim()})) > 0`)
    } else if (filter.type === 'dateRange' && Array.isArray(filter.value) && dateFields.has(filter.field)) {
      const [from, to] = filter.value
      if (from) conditions.push(Prisma.sql`${date(filter.field)} >= ${from.substring(0, 10)}`)
      if (to) conditions.push(Prisma.sql`${date(filter.field)} <= ${to.substring(0, 10)}`)
    }
  }
  if (phoneSearch) {
    const phoneFields = params.searchColumn === 'normalizedPhone'
      ? ['normalizedPhone', 'payloadPhone', 'processedLeadPhoneNumber']
      : params.searchColumn === 'alternatePhone' ? ['alternatePhone', 'payloadAlternatePhone'] : ['whatsapp', 'payloadWhatsapp']
    conditions.push(Prisma.sql`(${Prisma.join(phoneFields.map(field => Prisma.sql`right(regexp_replace(COALESCE(${col(field)}, ''), '[^0-9]', '', 'g'), 10) = ${phoneSearch.last10}`), ' OR ')})`)
  } else if (params.searchValue.trim()) {
    conditions.push(masterFields.has(params.searchColumn)
      ? Prisma.sql`lower(${displayText(params.searchColumn)}) = lower(${params.searchValue.trim()})`
      : Prisma.sql`strpos(lower(${displayText(params.searchColumn)}), lower(${params.searchValue.trim()})) > 0`)
  }
  const circle = payloadValue(['Circle', 'circle'])
  const circleCases = Array.from({ length: 23 }, (_, index) => String(index + 1))
    .map(code => Prisma.sql`WHEN ${code} THEN ${mapCircleCode(code)}`)
  const direction = Prisma.raw(params.sortDir.toUpperCase())
  const sort = params.sortBy === 'id' ? col('id') : dateFields.has(params.sortBy) ? col(params.sortBy) : Prisma.sql`lower(${displayText(params.sortBy)})`
  return Prisma.sql`
    WITH rows AS (
      SELECT i.id, i."receivedAt", i."processedAt", i.status, i.source, i."externalCampaignId", i."errorMessage",
        ${payloadValue(['campaign_id', 'campaignId', 'campaign id', 'campaign'])} AS "payloadCampaignId",
        COALESCE(c."displayName", COALESCE(i."externalCampaignId", ${payloadValue(['campaign_id', 'campaignId', 'campaign id', 'campaign'])}, 'No campaign ID') || ' (Unmapped)') AS "campaignName",
        cs.name AS "campaignSource", ls.name AS "leadSource",
        COALESCE(l.category, ${payloadValue(['Category', 'category'])}, c.category) AS category,
        COALESCE(l.treatment, ${payloadValue(['Treatment', 'treatment'])}, tm.name) AS treatment,
        COALESCE(CASE ${circle} ${Prisma.join(circleCases, ' ')} ELSE ${circle} END, cc.name) AS circle,
        ${payloadValue(['city_option', 'city'])} AS city,
        CASE WHEN p.mysql THEN ${payloadValue(['Patient_Name', 'patientName', 'patient_name'])}
          ELSE ${payloadValue(['name', 'patientName', 'patient_name'])} END AS "patientName",
        CASE WHEN p.mysql THEN ${payloadValue(['PatientEmail', 'email'])} ELSE ${payloadValue(['email'])} END AS email,
        i."normalizedPhone", ${payloadValue(['Patient_Number', 'phone', 'phoneNumber', 'mobile', 'mobileNumber'])} AS "payloadPhone",
        COALESCE(l."alternateNumber", ${payloadValue(['AlternativePhone', 'alternativePhone', 'alternatePhone', 'alternateNumber', 'altPhone'])}) AS "alternatePhone",
        ${payloadValue(['AlternativePhone', 'alternativePhone', 'alternatePhone', 'alternateNumber', 'altPhone'])} AS "payloadAlternatePhone",
        COALESCE(l.whatsapp, ${payloadValue(['Whatsapp', 'whatsapp', 'whatsApp', 'WhatsApp'])}) AS whatsapp,
        ${payloadValue(['Whatsapp', 'whatsapp', 'whatsApp', 'WhatsApp'])} AS "payloadWhatsapp",
        l."assignedDate", COALESCE(to_char(l."leadEntryDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS'), ${payloadValue(['LeadEntryDate', 'leadEntryDate', 'Lead_Date', 'leadDate', 'lead_date'])}) AS "leadDate",
        l."followUpDate", l."surgeryDate", l."leadRef" AS "processedLeadRef",
        l."patientName" AS "processedLeadPatientName", l."phoneNumber" AS "processedLeadPhoneNumber",
        tl.name AS "teamLeadName", tl.email AS "teamLeadEmail", bd.name AS "bdName", bd.email AS "bdEmail"
      FROM "IncomingLead" i
      LEFT JOIN "Lead" l ON l.id = i."processedLeadId"
      LEFT JOIN "CrmCampaign" c ON c."externalCampaignId" = i."externalCampaignId"
      LEFT JOIN "CrmCampaignSource" cs ON cs.id = c."sourceId"
      LEFT JOIN "CrmCampaignLeadSource" ls ON ls.id = c."leadSourceId"
      LEFT JOIN "CrmCampaignCircle" cc ON cc.id = c."circleId"
      LEFT JOIN "TreatmentMaster" tm ON tm.id = c."treatmentMasterId"
      LEFT JOIN "User" tl ON tl.id = i."selectedTeamLeadUserId"
      LEFT JOIN "User" bd ON bd.id = i."selectedBdUserId"
      CROSS JOIN LATERAL (SELECT CASE WHEN jsonb_typeof(i.payload->'data') = 'object' THEN i.payload->'data' ELSE i.payload END AS body) root
      CROSS JOIN LATERAL (SELECT CASE WHEN jsonb_typeof(root.body->'mysqlLead') = 'object' THEN root.body->'mysqlLead' ELSE root.body END AS body,
        jsonb_typeof(root.body->'mysqlLead') = 'object' AS mysql) p
      ${baseConditions.length ? Prisma.sql`WHERE ${Prisma.join(baseConditions, ' AND ')}` : Prisma.empty}
    ), filtered AS (SELECT * FROM rows r ${conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty}),
    totals AS (SELECT count(*)::integer AS total,
      count(*) FILTER (WHERE status = 'PROCESSED')::integer AS processed,
      count(*) FILTER (WHERE status = 'DUPLICATE')::integer AS duplicates,
      count(*) FILTER (WHERE status = 'FAILED')::integer AS failed,
      count(*) FILTER (WHERE status = 'BUCKET')::integer AS bucket FROM filtered),
    page AS (SELECT LEAST(${params.page}::integer, GREATEST(1, CEIL(total::numeric / ${params.pageSize})::integer)) AS number FROM totals)
    SELECT total, processed, duplicates, failed, bucket, page.number AS page, ARRAY(SELECT r.id FROM filtered r
      ORDER BY ${sort} ${direction} NULLS LAST, r.id ${direction}
      LIMIT ${params.pageSize} OFFSET ((SELECT number FROM page) - 1) * ${params.pageSize}) AS ids
    FROM totals CROSS JOIN page
  `
}
