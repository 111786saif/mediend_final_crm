export type DistributionInput = {
  category: string
  count: number
}

export type DistributionRow = {
  category: string
  count: number
  percent: number
  clickCategory: string
  isNeutral: boolean
}

export type DistributionMetrics = {
  totalCases: number
  categoryCount: number
  topCategoryShare: number
  uncategorizedShare: number
}

export type PreparedDistribution = {
  rows: DistributionRow[]
  metrics: DistributionMetrics
}

export const OTHER_CATEGORY_SENTINEL = '__other__'

/** Known spelling variants that should roll up to one canonical category name. */
const CATEGORY_ALIASES: Record<string, string> = {
  orthopedic: 'Orthopaedics',
  orthology: 'Orthopaedics',
  orthopaedics: 'Orthopaedics',
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function titleCaseCategory(value: string): string {
  return collapseWhitespace(value)
    .split(' ')
    .map((word) => {
      if (!word) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

function isUncategorizedRaw(value: string): boolean {
  const trimmed = collapseWhitespace(value)
  if (!trimmed) return true
  if (trimmed === '-') return true
  if (/^\d+$/.test(trimmed)) return true
  return false
}

function resolveCategoryName(rawCategory: string): string {
  if (isUncategorizedRaw(rawCategory)) return 'Uncategorized'
  const titled = titleCaseCategory(rawCategory)
  if (isUncategorizedRaw(titled)) return 'Uncategorized'
  return CATEGORY_ALIASES[titled.toLowerCase()] ?? titled
}

function isNeutralCategory(category: string): boolean {
  return category === 'Uncategorized' || category.startsWith('Other (')
}

/**
 * Normalizes, merges, ranks, and optionally folds long tails for disease distribution charts.
 */
export function prepareDistribution(data: DistributionInput[]): PreparedDistribution {
  const merged = new Map<string, { category: string; count: number }>()

  for (const row of data) {
    const count = Number.isFinite(row.count) ? Math.max(0, row.count) : 0
    if (count === 0) continue

    const category = resolveCategoryName(row.category ?? '')
    const key = category.toLowerCase()
    const existing = merged.get(key)
    if (existing) {
      existing.count += count
    } else {
      merged.set(key, { category, count })
    }
  }

  const allRows = Array.from(merged.values()).sort((a, b) => b.count - a.count)
  const grandTotal = allRows.reduce((sum, row) => sum + row.count, 0)

  if (grandTotal === 0) {
    return {
      rows: [],
      metrics: {
        totalCases: 0,
        categoryCount: 0,
        topCategoryShare: 0,
        uncategorizedShare: 0,
      },
    }
  }

  const withPercent = allRows.map((row) => ({
    ...row,
    percent: (row.count / grandTotal) * 100,
  }))

  const uncategorizedShare =
    withPercent.find((row) => row.category === 'Uncategorized')?.percent ?? 0
  const topCategoryShare = withPercent[0]?.percent ?? 0

  let displayRows: DistributionRow[]

  if (withPercent.length <= 9) {
    displayRows = withPercent.map((row) => ({
      category: row.category,
      count: row.count,
      percent: row.percent,
      clickCategory: row.category,
      isNeutral: isNeutralCategory(row.category),
    }))
  } else {
    const top = withPercent.slice(0, 8)
    const rest = withPercent.slice(8)
    const otherCount = rest.reduce((sum, row) => sum + row.count, 0)

    displayRows = top.map((row) => ({
      category: row.category,
      count: row.count,
      percent: row.percent,
      clickCategory: row.category,
      isNeutral: isNeutralCategory(row.category),
    }))

    if (otherCount > 0) {
      displayRows.push({
        category: `Other (${rest.length} categories)`,
        count: otherCount,
        percent: (otherCount / grandTotal) * 100,
        clickCategory: OTHER_CATEGORY_SENTINEL,
        isNeutral: true,
      })
    }
  }

  return {
    rows: displayRows,
    metrics: {
      totalCases: grandTotal,
      categoryCount: allRows.length,
      topCategoryShare,
      uncategorizedShare,
    },
  }
}
