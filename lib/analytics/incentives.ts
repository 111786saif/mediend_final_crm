interface BonusRuleLike {
  ruleType: 'PERCENT_ABOVE_TARGET' | 'FIXED_COUNT'
  thresholdValue: number
  bonusAmount: number | null
  bonusPercentage: number | null
  capAmount: number | null
}

/**
 * Computes a live incentive/reward amount for a target based on its BonusRules
 * and the actual achieved value. No incentive amounts are stored anywhere —
 * this is recalculated on every request from BonusRule + actual.
 *
 * Supported today:
 *  - FIXED_COUNT: pays `bonusAmount` (capped by `capAmount`, if set) once actual
 *    reaches `thresholdValue`.
 *  - PERCENT_ABOVE_TARGET: only computable when `bonusAmount` is also set,
 *    since count-based metrics (e.g. IPD_DONE) have no per-unit rupee value to
 *    apply a percentage to. In that case it behaves like FIXED_COUNT. If only
 *    `bonusPercentage` is set with no `bonusAmount`, the rule is skipped and
 *    flagged via `unresolvedRules` so the UI can note it needs configuration.
 */
export function calculateIncentive(rules: BonusRuleLike[], actual: number) {
  let totalReward = 0
  const earnedRules: BonusRuleLike[] = []
  const unresolvedRules: BonusRuleLike[] = []

  for (const rule of rules) {
    if (actual < rule.thresholdValue) continue

    if (rule.bonusAmount != null) {
      const amount = rule.capAmount != null ? Math.min(rule.bonusAmount, rule.capAmount) : rule.bonusAmount
      totalReward += amount
      earnedRules.push(rule)
    } else if (rule.ruleType === 'PERCENT_ABOVE_TARGET' && rule.bonusPercentage != null) {
      // No monetary base to apply the percentage to for count-based metrics —
      // flag for the admin to set a bonusAmount instead of leaving this silent.
      unresolvedRules.push(rule)
    }
  }

  return { totalReward, earnedRules, unresolvedRules }
}