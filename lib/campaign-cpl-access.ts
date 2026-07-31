import { PermissionLevel } from '@/generated/prisma/client'
import { hasEffectiveCrmPermission } from '@/lib/crm-permissions'
import { levelSatisfies, resolvePermission } from '@/lib/rbac-new'

export async function canViewCampaignCpl(userId: string): Promise<boolean> {
  if (await hasEffectiveCrmPermission(userId, 'crm.cpl.view')) return true
  const effective = await resolvePermission(userId, 'sales.campaign_cpl')
  return levelSatisfies(effective.level, PermissionLevel.READ)
}

export async function canManageCampaignCpl(userId: string): Promise<boolean> {
  if (await hasEffectiveCrmPermission(userId, 'crm.cpl.manage')) return true
  const effective = await resolvePermission(userId, 'sales.campaign_cpl')
  return levelSatisfies(effective.level, PermissionLevel.FULL_ACCESS)
}
