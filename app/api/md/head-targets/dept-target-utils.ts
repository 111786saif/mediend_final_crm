export type DepartmentTargetRow = { departmentId: string; addCount: number }

export function parseDepartmentTargets(json: unknown): DepartmentTargetRow[] | null {
  if (!json || !Array.isArray(json)) return null
  const rows: DepartmentTargetRow[] = []
  for (const item of json) {
    if (
      item &&
      typeof item === 'object' &&
      'departmentId' in item &&
      typeof (item as { departmentId: unknown }).departmentId === 'string' &&
      'addCount' in item &&
      typeof (item as { addCount: unknown }).addCount === 'number'
    ) {
      rows.push({
        departmentId: (item as { departmentId: string }).departmentId,
        addCount: Math.max(0, Math.round((item as { addCount: number }).addCount)),
      })
    }
  }
  return rows.length ? rows : null
}
