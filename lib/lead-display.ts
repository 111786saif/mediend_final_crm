export function formatLeadAgeSex(lead: { age?: number | null; sex?: string | null }): string {
  const age = lead.age
  const sex = typeof lead.sex === 'string' ? lead.sex.trim() : ''
  const hasAge = age != null && !Number.isNaN(Number(age))
  if (!hasAge && !sex) return '—'
  if (hasAge && sex) return `${age} / ${sex}`
  if (hasAge) return String(age)
  return sex
}
