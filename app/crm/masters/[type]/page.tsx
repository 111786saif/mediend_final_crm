import { notFound } from 'next/navigation'
import { CrmMasterPage, type CampaignMasterType } from '@/components/crm/crm-master-page'

const MASTER_TYPE_BY_SLUG: Record<string, CampaignMasterType> = {
  sources: 'source',
  'lead-sources': 'leadSource',
  circles: 'circle',
  cities: 'city',
}

export default async function CrmMasterTypePage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const { type } = await params
  const masterType = MASTER_TYPE_BY_SLUG[type]

  if (!masterType) {
    notFound()
  }

  return <CrmMasterPage masterType={masterType} />
}
