import type {
  SalesTeamCostRole,
  SalesTeamCostRollup,
  SalesTeamCostSummary,
} from '@/lib/sales-team-cost/types'

export function sumEntries(entries: { amount: number }[]): number {
  return entries.reduce((s, e) => s + e.amount, 0)
}

export function computeOwnDirectRollup(node: SalesTeamCostRole): SalesTeamCostRollup {
  const salary = node.salaryPerHead * node.count
  const incentives = node.incentiveAmount
  const seating = node.seatingAmount
  const misc = node.miscAmount
  const other = node.otherAmount
  const marketing = node.type === 'bd' ? (node.marketingCost ?? 0) : 0
  return {
    salary,
    incentives,
    seating,
    misc,
    other,
    marketing,
    total: salary + incentives + seating + misc + other + marketing,
  }
}

function emptyRollup(): SalesTeamCostRollup {
  return { salary: 0, incentives: 0, seating: 0, misc: 0, other: 0, marketing: 0, total: 0 }
}

function addRollup(acc: SalesTeamCostRollup, rollup: SalesTeamCostRollup): SalesTeamCostRollup {
  return {
    salary: acc.salary + rollup.salary,
    incentives: acc.incentives + rollup.incentives,
    seating: acc.seating + rollup.seating,
    misc: acc.misc + rollup.misc,
    other: acc.other + rollup.other,
    marketing: acc.marketing + rollup.marketing,
    total: acc.total + rollup.total,
  }
}

function sumDescendantDirectRollups(
  node: SalesTeamCostRole,
  type: SalesTeamCostRole['type'],
): SalesTeamCostRollup {
  return node.children.reduce<SalesTeamCostRollup>((acc, child) => {
    const next = child.type === type ? addRollup(acc, computeDirectRollup(child)) : acc
    return addRollup(next, sumDescendantDirectRollups(child, type))
  }, emptyRollup())
}

/**
 * Direct costs for a node.
 * - TL / ACM: own + all BD descendants
 * - Sales Head: own + full subtree (CM / TL / ACM / BD) so Other matches entry totals
 * - Others: own only
 */
export function computeDirectRollup(node: SalesTeamCostRole): SalesTeamCostRollup {
  const own = computeOwnDirectRollup(node)

  if (node.type === 'tl') {
    return addRollup(own, sumDescendantDirectRollups(node, 'bd'))
  }

  if (node.type === 'salesHead') {
    return computeDirectRollupTree(node)
  }

  return own
}

export function computeNodeTotal(node: SalesTeamCostRole): number {
  if (node.type === 'tl') return computeDirectRollup(node).total

  const direct = computeOwnDirectRollup(node)
  const childrenTotal = node.children.reduce((s, c) => s + computeNodeTotal(c), 0)
  return direct.total + childrenTotal
}

export function computeDirectRollupTree(node: SalesTeamCostRole): SalesTeamCostRollup {
  if (node.type === 'tl') return computeDirectRollup(node)

  const direct = computeOwnDirectRollup(node)
  for (const child of node.children) {
    const childRollup = computeDirectRollupTree(child)
    direct.salary += childRollup.salary
    direct.incentives += childRollup.incentives
    direct.seating += childRollup.seating
    direct.misc += childRollup.misc
    direct.other += childRollup.other
    direct.marketing += childRollup.marketing
  }
  direct.total =
    direct.salary +
    direct.incentives +
    direct.seating +
    direct.misc +
    direct.other +
    direct.marketing
  return direct
}

export function countHeadcount(nodes: SalesTeamCostRole[]): number {
  let count = 0
  const walk = (n: SalesTeamCostRole) => {
    count += n.count
    n.children.forEach(walk)
  }
  nodes.forEach(walk)
  return count
}

export function buildSummary(
  roots: SalesTeamCostRole[],
  unallocated: { misc: number; other: number } = { misc: 0, other: 0 },
): SalesTeamCostSummary {
  const rollup = roots.reduce<SalesTeamCostRollup>(
    (acc, root) => {
      const r = computeDirectRollupTree(root)
      return {
        salary: acc.salary + r.salary,
        incentives: acc.incentives + r.incentives,
        seating: acc.seating + r.seating,
        misc: acc.misc + r.misc,
        other: acc.other + r.other,
        marketing: acc.marketing + r.marketing,
        total: acc.total + r.total,
      }
    },
    { salary: 0, incentives: 0, seating: 0, misc: 0, other: 0, marketing: 0, total: 0 },
  )

  rollup.misc += unallocated.misc
  rollup.other += unallocated.other
  rollup.total += unallocated.misc + unallocated.other

  return {
    headcount: countHeadcount(roots),
    grandTotal: rollup.total,
    rollup,
    unallocated,
  }
}
