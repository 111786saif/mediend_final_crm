import { UserRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

export const CRM_LEAD_REMARK_SETTINGS_KEY = 'crm_lead_remark_settings_v1'

export type CrmLeadRemarkSettings = {
  allowAddRemarks: boolean
  allowRemoveRemarks: boolean
}

const DEFAULT_CRM_LEAD_REMARK_SETTINGS: CrmLeadRemarkSettings = {
  allowAddRemarks: true,
  allowRemoveRemarks: true,
}

function normalizeLeadRemarkSettings(value: unknown): CrmLeadRemarkSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_CRM_LEAD_REMARK_SETTINGS
  }

  const record = value as Record<string, unknown>

  return {
    allowAddRemarks:
      typeof record.allowAddRemarks === 'boolean'
        ? record.allowAddRemarks
        : DEFAULT_CRM_LEAD_REMARK_SETTINGS.allowAddRemarks,
    allowRemoveRemarks:
      typeof record.allowRemoveRemarks === 'boolean'
        ? record.allowRemoveRemarks
        : DEFAULT_CRM_LEAD_REMARK_SETTINGS.allowRemoveRemarks,
  }
}

export function canManageCrmLeadRemarkSettingsRole(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'CRM_ADMIN' || role === 'ADMIN'
}

export async function getCrmLeadRemarkSettings(): Promise<CrmLeadRemarkSettings> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: CRM_LEAD_REMARK_SETTINGS_KEY },
    select: { value: true },
  })

  if (!setting?.value) {
    return DEFAULT_CRM_LEAD_REMARK_SETTINGS
  }

  try {
    return normalizeLeadRemarkSettings(JSON.parse(setting.value))
  } catch {
    return DEFAULT_CRM_LEAD_REMARK_SETTINGS
  }
}

export async function saveCrmLeadRemarkSettings(
  settings: CrmLeadRemarkSettings,
  updatedByUserId: string
): Promise<CrmLeadRemarkSettings> {
  const normalized = normalizeLeadRemarkSettings(settings)

  await prisma.appSetting.upsert({
    where: { key: CRM_LEAD_REMARK_SETTINGS_KEY },
    create: {
      key: CRM_LEAD_REMARK_SETTINGS_KEY,
      value: JSON.stringify(normalized),
      updatedBy: updatedByUserId,
    },
    update: {
      value: JSON.stringify(normalized),
      updatedBy: updatedByUserId,
    },
  })

  return normalized
}
