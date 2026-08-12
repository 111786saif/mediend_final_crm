export function formatLeadAssigneeRoleLabel(role: string | null | undefined) {
  if (!role) return null
  return role
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function formatLeadAssigneeName(name: string | null | undefined, email?: string | null) {
  const trimmedName = name?.trim()
  if (trimmedName) return trimmedName

  const emailLocalPart = email?.trim().split('@')[0]?.trim()
  if (!emailLocalPart) return 'Unassigned'

  const normalized = emailLocalPart.replace(/[._-]+/g, ' ').trim()
  return normalized ? titleCase(normalized) : 'Unassigned'
}
