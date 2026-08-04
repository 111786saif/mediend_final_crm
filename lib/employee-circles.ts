export function parseEmployeeCircleList(value: string | string[] | null | undefined): string[] {
  const rawValues = Array.isArray(value) ? value : [value ?? '']
  const seen = new Set<string>()
  const circles: string[] = []

  for (const rawValue of rawValues) {
    for (const part of String(rawValue).split(',')) {
      const trimmed = part.trim()
      if (!trimmed) continue
      const normalized = trimmed.toLowerCase()
      if (seen.has(normalized)) continue
      seen.add(normalized)
      circles.push(trimmed)
    }
  }

  return circles
}

export function serializeEmployeeCircleList(value: string | string[] | null | undefined): string | null {
  const circles = parseEmployeeCircleList(value)
  return circles.length > 0 ? circles.join(', ') : null
}

export function employeeHasCircle(
  employeeCircleValue: string | string[] | null | undefined,
  targetCircle: string | null | undefined
): boolean {
  const normalizedTarget = targetCircle?.trim().toLowerCase()
  if (!normalizedTarget) return false

  return parseEmployeeCircleList(employeeCircleValue).some(
    (circle) => circle.trim().toLowerCase() === normalizedTarget
  )
}

export function employeeHasAnyCircle(
  employeeCircleValue: string | string[] | null | undefined
): boolean {
  return parseEmployeeCircleList(employeeCircleValue).length > 0
}
