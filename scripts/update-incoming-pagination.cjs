const fs = require('fs')
const apiPath = 'app/api/crm/incoming-leads/route.ts'
let api = fs.readFileSync(apiPath, 'utf8').replace(/\r\n/g, '\n')
api = api.replace("import { NextRequest }", "import { incomingLeadPageQuery, parseIncomingLeadPage } from '@/lib/incoming-leads/page-query'\nimport { NextRequest }")
api = api.replace('    const campaignData = await getCampaignManagementPageData(month, year)', `    let pageParams
    try {
      pageParams = parseIncomingLeadPage(searchParams)
    } catch {
      return errorResponse('Invalid pagination, sorting, or filters', 400)
    }
    const [pageResult] = await prisma.$queryRaw<Array<{ total: number; page: number; ids: number[] }>>(
      incomingLeadPageQuery(pageParams, hierarchyScopedUserIds, dateRange)
    )
    const campaignData = await getCampaignManagementPageData(month, year)`)
const start = api.indexOf('    const incomingLeads = await prisma.incomingLead.findMany(')
const end = api.indexOf('\n    const processedLeadIds', start)
api = api.slice(0, start) + `    const pageLeads = await prisma.incomingLead.findMany({
      where: { id: { in: pageResult.ids } },
      take: pageParams.pageSize,
    })
    const byId = new Map(pageLeads.map(lead => [lead.id, lead]))
    const incomingLeads = pageResult.ids.flatMap(id => {
      const lead = byId.get(id)
      return lead ? [lead] : []
    })
` + api.slice(end)
api = api.replace('.filter((value): value is string => Boolean(value))', '.filter((value): value is number => value !== null)')
const filterStart = api.indexOf('    const visibleScopeUserIds =')
const filterEnd = api.indexOf('    return successResponse(', filterStart)
api = api.slice(0, filterStart) + "    const canViewPhone = String(currentUser.role) === 'ADMIN'\n\n" + api.slice(filterEnd)
api = api.replace('      month: hasExplicitMonthFilter', `      total: pageResult.total,
      page: pageResult.page,
      pageSize: pageParams.pageSize,
      totalPages: Math.max(1, Math.ceil(pageResult.total / pageParams.pageSize)),
      month: hasExplicitMonthFilter`)
api = api.replace('searchedIncomingLeads.map', 'incomingLeads.map')
api = api.replace("import { last10DigitsFromStored, parsePhoneSearchQuery } from '@/lib/phone-search'\n", '')
fs.writeFileSync(apiPath, api)

const uiPath = 'components/crm/crm-incoming-leads-page.tsx'
let ui = fs.readFileSync(uiPath, 'utf8').replace(/\r\n/g, '\n')
ui = ui.replace('type IncomingLeadPageData = {', 'type IncomingLeadPageData = {\n  total: number\n  page: number\n  pageSize: number\n  totalPages: number')
const queryStart = ui.indexOf('  const { data, isLoading, error, refetch, isFetching } = useQuery')
const queryEnd = ui.indexOf('\n  const manualAssignOptionsQuery', queryStart)
ui = ui.slice(0, queryStart) + `  const serverFilters = Object.entries(columnFilters).flatMap(([field, value]) => {
    const type = filterConfigByField.get(field)?.filterType ?? 'multiSelect'
    return ['multiSelect', 'search', 'dateRange'].includes(type) && value != null
      ? [{ field, type, value }] : []
  })
  for (const [field, value] of Object.entries({ status: statusFilter, source: sourceFilter,
    campaignSource: campaignSourceFilter, leadSource: leadSourceFilter, category: categoryFilter,
    treatment: treatmentFilter, circle: circleFilter, city: cityFilter, teamLeadName: teamLeadFilter, bdName: bdFilter })) {
    if (value !== ALL_FILTER_VALUE) serverFilters.push({ field, type: 'multiSelect', value: [value] })
  }
  for (const [field, value] of Object.entries({ assignedDate: [assignDateFrom, assignDateTo],
    leadDate: [leadDateFrom, leadDateTo], followUpDate: [followUpDateFrom, followUpDateTo], surgeryDate: [surgeryDateFrom, surgeryDateTo] })) {
    if (value.some(Boolean)) serverFilters.push({ field, type: 'dateRange', value })
  }
  const listParams = new URLSearchParams({ page: String(currentPage), pageSize,
    sortBy: effectiveSortColumn, sortDir: sortDirection, searchColumn: effectiveSearchColumn,
    searchValue: searchValue.trim(), filters: JSON.stringify(serverFilters) })
  if (selectedMonth !== null) {
    listParams.set('month', String(selectedMonth))
    listParams.set('year', String(selectedYear))
  }
  const listQuery = listParams.toString()
  const { data, isLoading, error, refetch, isFetching } = useQuery<IncomingLeadPageData, Error>({
    queryKey: ['crm-incoming-leads', listQuery],
    queryFn: () => apiGet<IncomingLeadPageData>(\`/api/crm/incoming-leads?\${listQuery}\`),
    retry: false,
    enabled: hasAccess,
  })
` + ui.slice(queryEnd)
const filterStartUi = ui.indexOf('  const filteredRows = useMemo(')
const filterEndUi = ui.indexOf('  const selectedManualAssignLeads', filterStartUi)
ui = ui.slice(0, filterStartUi) + `  const sortedRows = rows
  const paginatedRows = rows
  const pageSizeNumber = Number.parseInt(pageSize, 10) || 50
  const totalRows = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const safeCurrentPage = data?.page ?? currentPage
  const pageStartIndex = totalRows === 0 ? 0 : (safeCurrentPage - 1) * pageSizeNumber
  const pageEndIndex = totalRows === 0 ? 0 : Math.min(pageStartIndex + rows.length, totalRows)

` + ui.slice(filterEndUi)
ui = ui.replace('    pageSize,\n  ])', '    pageSize,\n    columnFilters,\n  ])')
ui = ui.replace('disabled={safeCurrentPage <= 1}', 'disabled={isFetching || safeCurrentPage <= 1}')
ui = ui.replace('disabled={safeCurrentPage >= totalPages}', 'disabled={isFetching || safeCurrentPage >= totalPages}')
const optionsStart = ui.indexOf('  const filterOptions = useMemo(')
const optionsEnd = ui.indexOf('  const activeFilterCount', optionsStart)
ui = ui.slice(0, optionsStart) + `  const filterOptions = useMemo(() => {
    const values = (field: string) => (filterConfigByField.get(field)?.options ?? []).map(option => option.value)
    return {
      statuses: values('status'), sources: values('source'), campaignSources: values('campaignSource'),
      leadSources: values('leadSource'), categories: values('category'), treatments: values('treatment'),
      circles: values('circle'), cities: values('city'), teamLeads: values('teamLeadName'), bds: values('bdName'),
    }
  }, [filterConfigByField])

` + ui.slice(optionsEnd)
fs.writeFileSync(uiPath, ui)
