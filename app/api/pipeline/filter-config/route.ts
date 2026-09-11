import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { UserRole } from '@/generated/prisma/client'
import { CRM_LEAD_STATUS_OPTIONS, CRM_MODE_OF_PAYMENT_OPTIONS } from '@/lib/lead-status-options'
import { PIPELINE_MONTH_FILTER_OPTIONS } from '@/lib/pipeline/filter-normalizers'

function toOptions(values: Array<string | null | undefined>): Array<{ label: string; value: string }> {
  return [...new Set(values.filter((v): v is string => !!v && v.trim() !== '' && v !== '—'))]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ label: name, value: name }))
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'leads:read')) return errorResponse('Forbidden', 403)

    const [
      treatmentCategoryMasters,
      treatmentMasters,
      circleMasters,
      cityMasters,
      sourceMasters,
      leadSourceMasters,
      teamLeadUsers,
      bdUsers,
      leadCategories,
      leadTreatments,
      leadCircles,
      leadHospitals,
      leadDoctors,
      leadInsurances,
      leadSources,
      leadCampaignNames,
      leadStatuses,
    ] = await Promise.all([
      prisma.treatmentCategoryMaster.findMany({ select: { name: true } }),
      prisma.treatmentMaster.findMany({ select: { name: true } }),
      prisma.crmCampaignCircle.findMany({ select: { name: true } }),
      prisma.crmCampaignCity.findMany({ select: { name: true } }),
      prisma.crmCampaignSource.findMany({ select: { name: true } }),
      prisma.crmCampaignLeadSource.findMany({ select: { name: true } }),
      prisma.user.findMany({
        where: { role: UserRole.TEAM_LEAD },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        where: { role: { in: [UserRole.BD, UserRole.TEAM_LEAD] } },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.lead.findMany({
        where: { category: { not: null } },
        select: { category: true },
        distinct: ['category'],
      }),
      prisma.lead.findMany({
        where: { treatment: { not: '' } },
        select: { treatment: true },
        distinct: ['treatment'],
      }),
      prisma.lead.findMany({
        where: { circle: { not: '' } },
        select: { circle: true },
        distinct: ['circle'],
      }),
      prisma.lead.findMany({
        where: { hospitalName: { not: '' } },
        select: { hospitalName: true },
        distinct: ['hospitalName'],
      }),
      prisma.lead.findMany({
        where: { surgeonName: { not: '' } },
        select: { surgeonName: true },
        distinct: ['surgeonName'],
      }),
      prisma.lead.findMany({
        where: { insuranceName: { not: '' } },
        select: { insuranceName: true },
        distinct: ['insuranceName'],
      }),
      prisma.lead.findMany({
        where: { source: { not: '' } },
        select: { source: true },
        distinct: ['source'],
      }),
      prisma.lead.findMany({
        where: { campaignName: { not: '' } },
        select: { campaignName: true },
        distinct: ['campaignName'],
      }),
      prisma.lead.findMany({
        where: { status: { not: '' } },
        select: { status: true },
        distinct: ['status'],
      }),
    ])

    const categoryOptions = toOptions([
      ...treatmentCategoryMasters.map((c) => c.name),
      ...leadCategories.map((l) => l.category),
    ])

    const treatmentOptions = toOptions([
      ...treatmentMasters.map((t) => t.name),
      ...leadTreatments.map((l) => l.treatment),
    ])

    const circleOptions = toOptions([
      ...circleMasters.map((c) => c.name),
      ...leadCircles.map((l) => l.circle),
    ])

    const cityOptions = toOptions(cityMasters.map((c) => c.name))

    const hospitalOptions = toOptions(leadHospitals.map((h) => h.hospitalName))
    const doctorOptions = toOptions(leadDoctors.map((d) => d.surgeonName))
    const healthInsuranceOptions = toOptions(leadInsurances.map((i) => i.insuranceName))

    const sourceOptions = toOptions([
      ...sourceMasters.map((s) => s.name),
      ...leadSources.map((l) => l.source),
    ])

    const leadSourceOptions = toOptions([
      ...leadSourceMasters.map((s) => s.name),
      ...leadCampaignNames.map((l) => l.campaignName),
    ])

    const teamLeadOptions = toOptions(teamLeadUsers.map((u) => u.name))
    const bdOptions = toOptions(bdUsers.map((u) => u.name))

    const statusOptions = toOptions([
      ...CRM_LEAD_STATUS_OPTIONS,
      ...leadStatuses.map((s) => s.status),
    ])

    const mopOptions = toOptions([...CRM_MODE_OF_PAYMENT_OPTIONS])
    const monthOptions = toOptions([...PIPELINE_MONTH_FILTER_OPTIONS])

    return successResponse({
      filters: [
        { field: 'leadRef', label: 'Lead Ref', filterType: 'search', filterable: true },
        { field: 'assignDate', label: 'Assign Date', filterType: 'dateRange', filterable: true },
        { field: 'leadDate', label: 'Lead Date', filterType: 'dateRange', filterable: true },
        { field: 'patient', label: 'Patient Name', filterType: 'search', filterable: true },
        { field: 'alternateNumber', label: 'Alternate Number', filterType: 'search', filterable: true },
        { field: 'month', label: 'Month', filterType: 'multiSelect', filterable: true, options: monthOptions },
        { field: 'age', label: 'Age', filterType: 'search', filterable: true },
        { field: 'sex', label: 'Sex', filterType: 'multiSelect', filterable: true, options: toOptions(['Male', 'Female', 'Other']) },
        { field: 'circle', label: 'Circle', filterType: 'multiSelect', filterable: true, options: circleOptions },
        { field: 'city', label: 'City', filterType: 'multiSelect', filterable: true, options: cityOptions },
        { field: 'category', label: 'Category', filterType: 'multiSelect', filterable: true, options: categoryOptions },
        { field: 'treatment', label: 'Treatment', filterType: 'multiSelect', filterable: true, options: treatmentOptions },
        { field: 'planningTreatment', label: 'Planning Treatment', filterType: 'search', filterable: true },
        { field: 'profession', label: 'Profession', filterType: 'search', filterable: true },
        { field: 'tl', label: 'Team Lead', filterType: 'multiSelect', filterable: true, options: teamLeadOptions },
        { field: 'bd', label: 'BDM', filterType: 'multiSelect', filterable: true, options: bdOptions },
        { field: 'hospital', label: 'Hospital', filterType: 'multiSelect', filterable: true, options: hospitalOptions },
        { field: 'doctor', label: 'Doctor', filterType: 'multiSelect', filterable: true, options: doctorOptions },
        { field: 'lastRemarks', label: 'Last Remark', filterType: 'search', filterable: true },
        { field: 'status', label: 'Status', filterType: 'multiSelect', filterable: true, options: statusOptions },
        { field: 'followUpDate', label: 'Follow Up Date', filterType: 'dateRange', filterable: true },
        { field: 'mop', label: 'MOP', filterType: 'multiSelect', filterable: true, options: mopOptions },
        { field: 'subStatus', label: 'Sub Status', filterType: 'search', filterable: true },
        { field: 'surgeryDate', label: 'Surgery Date', filterType: 'dateRange', filterable: true },
        { field: 'healthInsurance', label: 'Health Insurance', filterType: 'multiSelect', filterable: true, options: healthInsuranceOptions },
        { field: 'preferredLocation', label: 'Preferred Location', filterType: 'multiSelect', filterable: true, options: circleOptions },
        { field: 'source', label: 'Source', filterType: 'multiSelect', filterable: true, options: sourceOptions },
        { field: 'leadSource', label: 'Lead Source', filterType: 'multiSelect', filterable: true, options: leadSourceOptions },
        { field: 'createDate', label: 'Create Date', filterType: 'dateRange', filterable: true },
        { field: 'modifyBy', label: 'Modify By', filterType: 'search', filterable: true },
        { field: 'modifyDate', label: 'Modified Date', filterType: 'dateRange', filterable: true },
        { field: 'dupCount', label: 'Duplicate Count', filterType: 'search', filterable: true },
        { field: 'recency', label: 'Recency', filterType: 'multiSelect', filterable: true, options: toOptions(['New (< 1 week)', '< 1 month', '1–2 months', '2–3 months', '3+ months']) },
      ],
    })
  } catch (error) {
    console.error('[pipeline/filter-config] Error:', error)
    return errorResponse('Failed to fetch filter config', 500)
  }
}
