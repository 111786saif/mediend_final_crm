import { CaseStage, FlowType, PipelineStage } from '@/generated/prisma/client'

export type WorkflowStepOwner = 'BD' | 'INSURANCE'

export interface WorkflowResetStepDef {
  number: number
  label: string
  shortLabel: string
  owner: WorkflowStepOwner
}

export interface WorkflowStepExtras {
  hasOpdScheduled: boolean
  hasInitiateForm: boolean
  hasIpdMark: boolean
}

const INSURANCE_STAGE_ORDER: Partial<Record<CaseStage, number>> = {
  [CaseStage.NEW_LEAD]: 0,
  [CaseStage.KYP_BASIC_COMPLETE]: 1,
  [CaseStage.HOSPITALS_SUGGESTED]: 2,
  [CaseStage.PREAUTH_RAISED]: 3,
  [CaseStage.PREAUTH_COMPLETE]: 4,
  [CaseStage.INITIATED]: 5,
  [CaseStage.DISCHARGED]: 6,
  [CaseStage.KYP_BASIC_PENDING]: 1,
  [CaseStage.KYP_DETAILED_PENDING]: 2,
  [CaseStage.KYP_DETAILED_COMPLETE]: 2,
  [CaseStage.KYP_PENDING]: 1,
  [CaseStage.KYP_COMPLETE]: 2,
  [CaseStage.ADMITTED]: 5,
  [CaseStage.IPD_DONE]: 6,
  [CaseStage.PL_PENDING]: 6,
  [CaseStage.OUTSTANDING]: 6,
}

export const INSURANCE_WORKFLOW_STEPS: WorkflowResetStepDef[] = [
  { number: 1, label: 'OPD Schedule', shortLabel: 'OPD Schedule', owner: 'BD' },
  { number: 2, label: 'Insurance Card Details', shortLabel: 'Card Details', owner: 'BD' },
  { number: 3, label: 'Suggest Hospitals', shortLabel: 'Hospitals', owner: 'INSURANCE' },
  { number: 4, label: 'Pre-Auth Raise', shortLabel: 'Pre-Auth Raise', owner: 'BD' },
  { number: 5, label: 'Pre-Auth Approval', shortLabel: 'PA Approval', owner: 'INSURANCE' },
  { number: 6, label: 'Insurance Initial Form', shortLabel: 'Initial Form', owner: 'INSURANCE' },
  { number: 7, label: 'IPD Details', shortLabel: 'IPD Details', owner: 'BD' },
  { number: 8, label: 'IPD Mark', shortLabel: 'IPD Mark', owner: 'BD' },
  { number: 9, label: 'Discharge Summary', shortLabel: 'Discharge', owner: 'INSURANCE' },
]

export const CASH_WORKFLOW_STEPS: WorkflowResetStepDef[] = [
  { number: 1, label: 'IPD Cash Form', shortLabel: 'IPD Form', owner: 'BD' },
  { number: 2, label: 'Insurance Review', shortLabel: 'Review', owner: 'INSURANCE' },
  { number: 3, label: 'Approved', shortLabel: 'Approved', owner: 'INSURANCE' },
  { number: 4, label: 'IPD Done', shortLabel: 'IPD Done', owner: 'BD' },
  { number: 5, label: 'Discharge', shortLabel: 'Discharge', owner: 'INSURANCE' },
]

const CASH_STAGE_ORDER: Partial<Record<CaseStage, number>> = {
  [CaseStage.CASH_IPD_PENDING]: 1,
  [CaseStage.CASH_IPD_SUBMITTED]: 2,
  [CaseStage.CASH_ON_HOLD]: 2,
  [CaseStage.CASH_APPROVED]: 3,
  [CaseStage.CASH_IPD_DONE]: 4,
  [CaseStage.CASH_DISCHARGED]: 5,
}

function insuranceStepDone(step: number, stageIndex: number, extras: WorkflowStepExtras): boolean {
  switch (step) {
    case 1:
      return extras.hasOpdScheduled
    case 2:
      return extras.hasOpdScheduled && stageIndex >= 1
    case 3:
      return extras.hasOpdScheduled && stageIndex >= 2
    case 4:
      return extras.hasOpdScheduled && stageIndex >= 3
    case 5:
      return extras.hasOpdScheduled && stageIndex >= 4
    case 6:
      return extras.hasOpdScheduled && stageIndex >= 4 && extras.hasInitiateForm
    case 7:
      return extras.hasOpdScheduled && stageIndex >= 5
    case 8:
      return extras.hasOpdScheduled && stageIndex >= 5 && extras.hasIpdMark
    case 9:
      return extras.hasOpdScheduled && stageIndex >= 6
    default:
      return false
  }
}

export function getInsuranceStageIndex(stage: CaseStage): number {
  return INSURANCE_STAGE_ORDER[stage] ?? 0
}

export function getInsuranceCurrentStep(stage: CaseStage, extras: WorkflowStepExtras): number {
  const stageIndex = getInsuranceStageIndex(stage)
  for (const step of INSURANCE_WORKFLOW_STEPS) {
    if (!insuranceStepDone(step.number, stageIndex, extras)) return step.number
  }
  return INSURANCE_WORKFLOW_STEPS.length
}

export function getCashCurrentStep(stage: CaseStage): number {
  const idx = CASH_STAGE_ORDER[stage] ?? 0
  if (idx >= 5) return 5
  if (idx <= 0) return 1
  return idx
}

export function getWorkflowSteps(flowType: FlowType | null | undefined): WorkflowResetStepDef[] {
  return flowType === FlowType.CASH ? CASH_WORKFLOW_STEPS : INSURANCE_WORKFLOW_STEPS
}

export function getCurrentWorkflowStep(
  flowType: FlowType | null | undefined,
  stage: CaseStage,
  extras: WorkflowStepExtras,
): number {
  if (flowType === FlowType.CASH) return getCashCurrentStep(stage)
  return getInsuranceCurrentStep(stage, extras)
}

function cashStepDone(step: number, stageIndex: number): boolean {
  switch (step) {
    case 1:
      return stageIndex >= 2
    case 2:
      return stageIndex >= 3
    case 3:
      return stageIndex >= 4
    case 4:
      return stageIndex >= 5
    case 5:
      return stageIndex >= 5
    default:
      return false
  }
}

export function getCompletedResetTargets(
  flowType: FlowType | null | undefined,
  stage: CaseStage,
  extras: WorkflowStepExtras,
): WorkflowResetStepDef[] {
  const steps = getWorkflowSteps(flowType)
  const current = getCurrentWorkflowStep(flowType, stage, extras)
  const stageIndex =
    flowType === FlowType.CASH ? (CASH_STAGE_ORDER[stage] ?? 0) : getInsuranceStageIndex(stage)

  return steps.filter((step) => {
    const done =
      flowType === FlowType.CASH
        ? cashStepDone(step.number, stageIndex)
        : insuranceStepDone(step.number, stageIndex, extras)
    // Previously completed steps (and the final step once the case is fully complete).
    return done && step.number <= current
  })
}

export interface ResetTargetConfig {
  caseStage: CaseStage
  pipelineStage: PipelineStage
  /** Clear KYP card submission (cascades PreAuth). */
  clearKyp: boolean
  clearOpdSchedule: boolean
  /** Delete PreAuthorization (+ suggestions). */
  clearPreAuth: boolean
  /** Clear raise/approval fields but keep hospital suggestions. */
  clearPreAuthRaise: boolean
  /** Clear approval/reject/hold only. */
  clearPreAuthApproval: boolean
  clearInitiateForm: boolean
  clearAdmission: boolean
  clearIpdMark: boolean
  clearDischargeAndDownstream: boolean
  resetLeadStatus: string | null
}

/** Config for resetting TO a step (that step becomes current/active again). */
export function getResetTargetConfig(
  flowType: FlowType | null | undefined,
  targetStep: number,
): ResetTargetConfig {
  if (flowType === FlowType.CASH) {
    switch (targetStep) {
      case 1:
        return {
          caseStage: CaseStage.CASH_IPD_PENDING,
          pipelineStage: PipelineStage.SALES,
          clearKyp: false,
          clearOpdSchedule: false,
          clearPreAuth: false,
          clearPreAuthRaise: false,
          clearPreAuthApproval: false,
          clearInitiateForm: false,
          clearAdmission: true,
          clearIpdMark: true,
          clearDischargeAndDownstream: true,
          resetLeadStatus: null,
        }
      case 2:
        return {
          caseStage: CaseStage.CASH_IPD_SUBMITTED,
          pipelineStage: PipelineStage.INSURANCE,
          clearKyp: false,
          clearOpdSchedule: false,
          clearPreAuth: false,
          clearPreAuthRaise: false,
          clearPreAuthApproval: false,
          clearInitiateForm: false,
          clearAdmission: false,
          clearIpdMark: true,
          clearDischargeAndDownstream: true,
          resetLeadStatus: null,
        }
      case 3:
        return {
          caseStage: CaseStage.CASH_APPROVED,
          pipelineStage: PipelineStage.INSURANCE,
          clearKyp: false,
          clearOpdSchedule: false,
          clearPreAuth: false,
          clearPreAuthRaise: false,
          clearPreAuthApproval: false,
          clearInitiateForm: false,
          clearAdmission: false,
          clearIpdMark: true,
          clearDischargeAndDownstream: true,
          resetLeadStatus: null,
        }
      case 4:
        return {
          caseStage: CaseStage.CASH_IPD_DONE,
          pipelineStage: PipelineStage.INSURANCE,
          clearKyp: false,
          clearOpdSchedule: false,
          clearPreAuth: false,
          clearPreAuthRaise: false,
          clearPreAuthApproval: false,
          clearInitiateForm: false,
          clearAdmission: false,
          clearIpdMark: false,
          clearDischargeAndDownstream: true,
          resetLeadStatus: null,
        }
      case 5:
      default:
        return {
          caseStage: CaseStage.CASH_IPD_DONE,
          pipelineStage: PipelineStage.INSURANCE,
          clearKyp: false,
          clearOpdSchedule: false,
          clearPreAuth: false,
          clearPreAuthRaise: false,
          clearPreAuthApproval: false,
          clearInitiateForm: false,
          clearAdmission: false,
          clearIpdMark: false,
          clearDischargeAndDownstream: true,
          resetLeadStatus: null,
        }
    }
  }

  switch (targetStep) {
    case 1:
      return {
        caseStage: CaseStage.NEW_LEAD,
        pipelineStage: PipelineStage.SALES,
        clearKyp: true,
        clearOpdSchedule: true,
        clearPreAuth: true,
        clearPreAuthRaise: true,
        clearPreAuthApproval: true,
        clearInitiateForm: true,
        clearAdmission: true,
        clearIpdMark: true,
        clearDischargeAndDownstream: true,
        resetLeadStatus: 'New Lead',
      }
    case 2:
      return {
        caseStage: CaseStage.NEW_LEAD,
        pipelineStage: PipelineStage.SALES,
        clearKyp: true,
        clearOpdSchedule: false,
        clearPreAuth: true,
        clearPreAuthRaise: true,
        clearPreAuthApproval: true,
        clearInitiateForm: true,
        clearAdmission: true,
        clearIpdMark: true,
        clearDischargeAndDownstream: true,
        resetLeadStatus: null,
      }
    case 3:
      return {
        caseStage: CaseStage.KYP_BASIC_COMPLETE,
        pipelineStage: PipelineStage.SALES,
        clearKyp: false,
        clearOpdSchedule: false,
        clearPreAuth: true,
        clearPreAuthRaise: true,
        clearPreAuthApproval: true,
        clearInitiateForm: true,
        clearAdmission: true,
        clearIpdMark: true,
        clearDischargeAndDownstream: true,
        resetLeadStatus: null,
      }
    case 4:
      return {
        caseStage: CaseStage.HOSPITALS_SUGGESTED,
        pipelineStage: PipelineStage.INSURANCE,
        clearKyp: false,
        clearOpdSchedule: false,
        clearPreAuth: false,
        clearPreAuthRaise: true,
        clearPreAuthApproval: true,
        clearInitiateForm: true,
        clearAdmission: true,
        clearIpdMark: true,
        clearDischargeAndDownstream: true,
        resetLeadStatus: null,
      }
    case 5:
      return {
        caseStage: CaseStage.PREAUTH_RAISED,
        pipelineStage: PipelineStage.INSURANCE,
        clearKyp: false,
        clearOpdSchedule: false,
        clearPreAuth: false,
        clearPreAuthRaise: false,
        clearPreAuthApproval: true,
        clearInitiateForm: true,
        clearAdmission: true,
        clearIpdMark: true,
        clearDischargeAndDownstream: true,
        resetLeadStatus: null,
      }
    case 6:
      return {
        caseStage: CaseStage.PREAUTH_COMPLETE,
        pipelineStage: PipelineStage.INSURANCE,
        clearKyp: false,
        clearOpdSchedule: false,
        clearPreAuth: false,
        clearPreAuthRaise: false,
        clearPreAuthApproval: false,
        clearInitiateForm: true,
        clearAdmission: true,
        clearIpdMark: true,
        clearDischargeAndDownstream: true,
        resetLeadStatus: null,
      }
    case 7:
      return {
        caseStage: CaseStage.PREAUTH_COMPLETE,
        pipelineStage: PipelineStage.INSURANCE,
        clearKyp: false,
        clearOpdSchedule: false,
        clearPreAuth: false,
        clearPreAuthRaise: false,
        clearPreAuthApproval: false,
        clearInitiateForm: false,
        clearAdmission: true,
        clearIpdMark: true,
        clearDischargeAndDownstream: true,
        resetLeadStatus: null,
      }
    case 8:
      return {
        caseStage: CaseStage.INITIATED,
        pipelineStage: PipelineStage.INSURANCE,
        clearKyp: false,
        clearOpdSchedule: false,
        clearPreAuth: false,
        clearPreAuthRaise: false,
        clearPreAuthApproval: false,
        clearInitiateForm: false,
        clearAdmission: false,
        clearIpdMark: true,
        clearDischargeAndDownstream: true,
        resetLeadStatus: null,
      }
    case 9:
    default:
      return {
        caseStage: CaseStage.IPD_DONE,
        pipelineStage: PipelineStage.INSURANCE,
        clearKyp: false,
        clearOpdSchedule: false,
        clearPreAuth: false,
        clearPreAuthRaise: false,
        clearPreAuthApproval: false,
        clearInitiateForm: false,
        clearAdmission: false,
        clearIpdMark: false,
        clearDischargeAndDownstream: true,
        resetLeadStatus: null,
      }
  }
}

export function notificationLinkForStep(leadId: string, step: WorkflowResetStepDef): string {
  switch (step.number) {
    case 1:
      return `/patient/${leadId}/opd-schedule`
    case 2:
      return `/patient/${leadId}/kyp/basic`
    case 3:
      return `/patient/${leadId}/pre-auth`
    case 4:
      return `/patient/${leadId}/raise-preauth`
    case 5:
      return `/patient/${leadId}/pre-auth`
    case 6:
      return `/patient/${leadId}`
    case 7:
      return `/patient/${leadId}`
    case 8:
      return `/patient/${leadId}`
    case 9:
      return `/patient/${leadId}`
    default:
      return `/patient/${leadId}`
  }
}

export function buildWorkflowResetTimelineNote(args: {
  fromLabel: string
  toLabel: string
  resetByName: string
  reason: string
}): string {
  return [
    'Workflow Reset',
    `Reset from ${args.fromLabel} to ${args.toLabel} by Executive Assistant (${args.resetByName}).`,
    `Reason: ${args.reason}`,
  ].join('\n')
}
