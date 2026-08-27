import { CaseStage } from '@/generated/prisma/client'

const CASE_STAGE_PROGRESS: Partial<Record<CaseStage, number>> = {
  [CaseStage.NEW_LEAD]: 0,
  [CaseStage.CASH_IPD_PENDING]: 0,
  [CaseStage.OPD_SCHEDULED]: 1,
  [CaseStage.CASH_OPD_SCHEDULED]: 1,
  [CaseStage.OPD_DONE]: 2,
  [CaseStage.CASH_OPD_DONE]: 2,
  [CaseStage.KYP_BASIC_PENDING]: 2,
  [CaseStage.KYP_PENDING]: 2,
  [CaseStage.KYP_BASIC_COMPLETE]: 3,
  [CaseStage.CASH_IPD_SUBMITTED]: 3,
  [CaseStage.CASH_ON_HOLD]: 3,
  [CaseStage.HOSPITALS_SUGGESTED]: 4,
  [CaseStage.KYP_DETAILED_PENDING]: 4,
  [CaseStage.KYP_DETAILED_COMPLETE]: 4,
  [CaseStage.KYP_COMPLETE]: 4,
  [CaseStage.CASH_APPROVED]: 4,
  [CaseStage.PREAUTH_RAISED]: 5,
  [CaseStage.PREAUTH_COMPLETE]: 6,
  [CaseStage.INITIATED]: 7,
  [CaseStage.ADMITTED]: 7,
  [CaseStage.IPD_DONE]: 8,
  [CaseStage.CASH_IPD_DONE]: 8,
  [CaseStage.DISCHARGED]: 9,
  [CaseStage.CASH_DISCHARGED]: 9,
  [CaseStage.PL_PENDING]: 9,
  [CaseStage.OUTSTANDING]: 9,
}

export function isCaseStageRegression(currentStage: CaseStage, nextStage: CaseStage): boolean {
  const currentProgress = CASE_STAGE_PROGRESS[currentStage]
  const nextProgress = CASE_STAGE_PROGRESS[nextStage]

  return currentProgress !== undefined && nextProgress !== undefined && nextProgress < currentProgress
}
