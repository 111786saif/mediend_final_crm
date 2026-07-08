import {
  canReceiveIncentive,
  type SalesTeamCostRole,
  type SalesTeamCostRollup,
  type SalesTeamCostSummary,
} from '@/lib/sales-team-cost/types'

export function sumEntries(entries: { amount: number }[]): number {
  return entries.reduce((s, e) => s + e.amount, 0)
}

export function computeDirectRollup(node: SalesTeamCostRole): SalesTeamCostRollup {
  const salary = node.salaryPerHead * node.count
  const incentives = canReceiveIncentive(node.type) ? sumEntries(node.incentives) : 0
  const seating = sumEntries(node.seatingCosts)
  const misc = sumEntries(node.miscCosts)
  const marketing = node.type === 'bd' ? (node.marketingCost ?? 0) : 0
  return {
    salary,
    incentives,
    seating,
    misc,
    marketing,
    total: salary + incentives + seating + misc + marketing,
  }
}

export function computeNodeTotal(node: SalesTeamCostRole): number {
  const direct = computeDirectRollup(node)
  const childrenTotal = node.children.reduce((s, c) => s + computeNodeTotal(c), 0)
  return direct.total + childrenTotal
}

export function computeDirectRollupTree(node: SalesTeamCostRole): SalesTeamCostRollup {
  const direct = computeDirectRollup(node)
  for (const child of node.children) {
    const childRollup = computeDirectRollupTree(child)
    direct.salary += childRollup.salary
    direct.incentives += childRollup.incentives
    direct.seating += childRollup.seating
    direct.misc += childRollup.misc
    direct.marketing += childRollup.marketing
  }
  direct.total = direct.salary + direct.incentives + direct.seating + direct.misc + direct.marketing
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

export function buildSummary(roots: SalesTeamCostRole[]): SalesTeamCostSummary {
  const rollup = roots.reduce<SalesTeamCostRollup>(
    (acc, root) => {
      const r = computeDirectRollupTree(root)
      return {
        salary: acc.salary + r.salary,
        incentives: acc.incentives + r.incentives,
        seating: acc.seating + r.seating,
        misc: acc.misc + r.misc,
        marketing: acc.marketing + r.marketing,
        total: acc.total + r.total,
      }
    },
    { salary: 0, incentives: 0, seating: 0, misc: 0, marketing: 0, total: 0 },
  )

  return {
    headcount: countHeadcount(roots),
    grandTotal: rollup.total,
    rollup,
  }
}
