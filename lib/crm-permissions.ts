import { UserRole } from '@/generated/prisma/enums'
import { prisma } from '@/lib/prisma'

export const CRM_ADMIN_DELEGABLE_PERMISSIONS_SETTING_KEY = 'crm_admin_delegable_permissions'

type CrmPermissionCategory = 'Access Matrix' | 'Campaigns' | 'Churn Rules' | 'CPL' | 'Assignment'

type CrmPermissionDefinition = {
  key: string
  label: string
  description: string
  category: CrmPermissionCategory
  defaultRoles: readonly UserRole[]
  delegableBySuperAdmin: boolean
}

const CRM_PERMISSION_DEFINITIONS = [
  {
    key: 'crm.access_matrix.view',
    label: 'View CRM Access Matrix',
    description: 'See CRM permission assignments and delegation policy.',
    category: 'Access Matrix',
    defaultRoles: ['SUPER_ADMIN', 'CRM_ADMIN'],
    delegableBySuperAdmin: true,
  },
  {
    key: 'crm.access_matrix.manage',
    label: 'Manage CRM Access Matrix',
    description: 'Grant or revoke CRM permissions for users.',
    category: 'Access Matrix',
    defaultRoles: ['SUPER_ADMIN', 'CRM_ADMIN'],
    delegableBySuperAdmin: true,
  },
  {
    key: 'crm.access_matrix.delegate',
    label: 'Manage CRM Delegation Policy',
    description: 'Choose which CRM permissions CRM Admins may manage for others.',
    category: 'Access Matrix',
    defaultRoles: ['SUPER_ADMIN'],
    delegableBySuperAdmin: false,
  },
  {
    key: 'crm.campaigns.manage',
    label: 'Manage Campaigns',
    description: 'Manage CRM campaign configuration when that surface is introduced.',
    category: 'Campaigns',
    defaultRoles: ['SUPER_ADMIN', 'CRM_ADMIN'],
    delegableBySuperAdmin: true,
  },
  {
    key: 'crm.churn_rules.manage',
    label: 'Manage Churn Rules',
    description: 'Manage CRM churned-lead rules when that surface is introduced.',
    category: 'Churn Rules',
    defaultRoles: ['SUPER_ADMIN', 'CRM_ADMIN'],
    delegableBySuperAdmin: true,
  },
  {
    key: 'crm.assignment_rules.view',
    label: 'View Assignment Rules',
    description: 'View CRM auto-assignment rules and member pools.',
    category: 'Assignment',
    defaultRoles: ['SUPER_ADMIN', 'CRM_ADMIN', 'ADMIN', 'SALES_HEAD'],
    delegableBySuperAdmin: true,
  },
  {
    key: 'crm.assignment_rules.manage',
    label: 'Manage Assignment Rules',
    description: 'Create and update CRM auto-assignment rules and member pools.',
    category: 'Assignment',
    defaultRoles: ['SUPER_ADMIN', 'CRM_ADMIN', 'ADMIN'],
    delegableBySuperAdmin: true,
  },
  {
    key: 'crm.assignment_dry_run.view',
    label: 'View Assignment Dry Runs',
    description: 'Run CRM assignment previews and inspect rule outcomes.',
    category: 'Assignment',
    defaultRoles: ['SUPER_ADMIN', 'CRM_ADMIN', 'ADMIN', 'SALES_HEAD'],
    delegableBySuperAdmin: true,
  },
  {
    key: 'crm.cpl.view',
    label: 'View Target CPL vs Current CPL',
    description: 'View CRM-sensitive CPL comparisons and daily campaign spend data.',
    category: 'CPL',
    defaultRoles: ['SUPER_ADMIN', 'CRM_ADMIN', 'ADMIN'],
    delegableBySuperAdmin: true,
  },
  {
    key: 'crm.cpl.manage',
    label: 'Manage Target CPL vs Current CPL',
    description: 'Edit CRM-sensitive CPL and daily campaign spend data.',
    category: 'CPL',
    defaultRoles: ['SUPER_ADMIN', 'CRM_ADMIN', 'ADMIN'],
    delegableBySuperAdmin: true,
  },
] as const satisfies readonly CrmPermissionDefinition[]

export type CrmPermissionKey = (typeof CRM_PERMISSION_DEFINITIONS)[number]['key']

export type CrmPermissionDefinitionRecord = (typeof CRM_PERMISSION_DEFINITIONS)[number]

const CRM_PERMISSION_KEYS = CRM_PERMISSION_DEFINITIONS.map((permission) => permission.key) as CrmPermissionKey[]

const CRM_ADMIN_DEFAULT_DELEGABLE_KEYS: CrmPermissionKey[] = [
  'crm.campaigns.manage',
  'crm.churn_rules.manage',
  'crm.assignment_rules.view',
  'crm.assignment_rules.manage',
  'crm.assignment_dry_run.view',
  'crm.cpl.view',
  'crm.cpl.manage',
]

const PROTECTED_CRM_MATRIX_TARGET_ROLES = new Set<UserRole>(['SUPER_ADMIN', 'CRM_ADMIN', 'MD', 'ADMIN'])

function uniquePermissionKeys(keys: readonly CrmPermissionKey[]): CrmPermissionKey[] {
  return [...new Set(keys)]
}

export function getCrmPermissionRegistry(): readonly CrmPermissionDefinitionRecord[] {
  return CRM_PERMISSION_DEFINITIONS
}

export function isCrmPermissionKey(value: string): value is CrmPermissionKey {
  return CRM_PERMISSION_KEYS.includes(value as CrmPermissionKey)
}

export function getCrmPermissionDefinition(key: CrmPermissionKey): CrmPermissionDefinitionRecord {
  return CRM_PERMISSION_DEFINITIONS.find((permission) => permission.key === key)!
}

export function getDefaultCrmPermissionKeysForRole(role: UserRole): CrmPermissionKey[] {
  if (role === 'SUPER_ADMIN') {
    return [...CRM_PERMISSION_KEYS]
  }
  return CRM_PERMISSION_DEFINITIONS
    .filter((permission) => (permission.defaultRoles as readonly UserRole[]).includes(role))
    .map((permission) => permission.key)
}

export function getDefaultCrmPermissionState(role: UserRole, permissionKey: CrmPermissionKey): boolean {
  return getDefaultCrmPermissionKeysForRole(role).includes(permissionKey)
}

export function resolveCrmPermissionState(
  role: UserRole,
  permissionKey: CrmPermissionKey,
  explicitEnabled: boolean | null | undefined
): boolean {
  if (role === 'SUPER_ADMIN') {
    return true
  }
  if (typeof explicitEnabled === 'boolean') {
    return explicitEnabled
  }
  return getDefaultCrmPermissionState(role, permissionKey)
}

export async function getCrmAdminDelegablePermissionKeys(): Promise<CrmPermissionKey[]> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: CRM_ADMIN_DELEGABLE_PERMISSIONS_SETTING_KEY },
    select: { value: true },
  })

  if (!setting?.value) {
    return CRM_ADMIN_DEFAULT_DELEGABLE_KEYS
  }

  try {
    const parsed = JSON.parse(setting.value)
    if (!Array.isArray(parsed)) {
      return CRM_ADMIN_DEFAULT_DELEGABLE_KEYS
    }
    const filtered = parsed.filter((value): value is CrmPermissionKey => isCrmPermissionKey(String(value)))
    return filtered.length > 0 ? uniquePermissionKeys(filtered) : CRM_ADMIN_DEFAULT_DELEGABLE_KEYS
  } catch {
    return CRM_ADMIN_DEFAULT_DELEGABLE_KEYS
  }
}

export async function setCrmAdminDelegablePermissionKeys(
  permissionKeys: readonly CrmPermissionKey[],
  updatedByUserId: string
): Promise<CrmPermissionKey[]> {
  const normalized = uniquePermissionKeys(
    permissionKeys.filter((key) => getCrmPermissionDefinition(key).delegableBySuperAdmin)
  )

  await prisma.appSetting.upsert({
    where: { key: CRM_ADMIN_DELEGABLE_PERMISSIONS_SETTING_KEY },
    create: {
      key: CRM_ADMIN_DELEGABLE_PERMISSIONS_SETTING_KEY,
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

export async function hasCrmPermission(userId: string, permissionKey: CrmPermissionKey): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (!user) return false

  const explicit = await prisma.userCrmPermission.findUnique({
    where: {
      userId_permissionKey: {
        userId,
        permissionKey,
      },
    },
    select: { enabled: true },
  })

  return resolveCrmPermissionState(user.role, permissionKey, explicit?.enabled)
}

export async function hasEffectiveCrmPermission(userId: string, permissionKey: CrmPermissionKey): Promise<boolean> {
  return hasCrmPermission(userId, permissionKey)
}

export async function canManageCrmPermission(
  actor: { id: string; role: UserRole },
  targetUser: { id: string; role: UserRole },
  permissionKey: CrmPermissionKey
): Promise<boolean> {
  if (!isCrmPermissionKey(permissionKey)) {
    return false
  }

  if (actor.role === 'SUPER_ADMIN') {
    return true
  }

  if (!(await hasCrmPermission(actor.id, 'crm.access_matrix.manage'))) {
    return false
  }

  if (PROTECTED_CRM_MATRIX_TARGET_ROLES.has(targetUser.role)) {
    return false
  }

  if (await hasCrmPermission(actor.id, 'crm.access_matrix.delegate')) {
    return true
  }

  const policy = await getCrmAdminDelegablePermissionKeys()
  return policy.includes(permissionKey)
}

export async function getEffectiveCrmPermissionsForUsers(
  users: Array<{ id: string; role: UserRole }>
): Promise<Map<string, Record<CrmPermissionKey, { enabled: boolean; source: 'default' | 'override' }>>> {
  const overrides = await prisma.userCrmPermission.findMany({
    where: { userId: { in: users.map((user) => user.id) } },
    select: { userId: true, permissionKey: true, enabled: true },
  })

  const overrideMap = new Map<string, Map<CrmPermissionKey, boolean>>()
  for (const override of overrides) {
    if (!isCrmPermissionKey(override.permissionKey)) continue
    const perUser = overrideMap.get(override.userId) ?? new Map<CrmPermissionKey, boolean>()
    perUser.set(override.permissionKey, override.enabled)
    overrideMap.set(override.userId, perUser)
  }

  const result = new Map<string, Record<CrmPermissionKey, { enabled: boolean; source: 'default' | 'override' }>>()
  for (const user of users) {
    const explicitForUser = overrideMap.get(user.id)
    const row = {} as Record<CrmPermissionKey, { enabled: boolean; source: 'default' | 'override' }>
    for (const key of CRM_PERMISSION_KEYS) {
      const explicit = explicitForUser?.get(key)
      row[key] = {
        enabled: resolveCrmPermissionState(user.role, key, explicit),
        source: typeof explicit === 'boolean' ? 'override' : 'default',
      }
    }
    result.set(user.id, row)
  }

  return result
}

export function getProtectedCrmMatrixTargetRoles(): readonly UserRole[] {
  return [...PROTECTED_CRM_MATRIX_TARGET_ROLES]
}
