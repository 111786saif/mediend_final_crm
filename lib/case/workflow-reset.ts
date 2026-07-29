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
  hasOpdDone: boolean
  hasInitiateForm: boolean
  hasIpdMark: boolean
}

const INSURANCE_STAGE_ORDER: Partial<Record<CaseStage, number>> = {
  [CaseStage.NEW_LEAD]: 0,
  [CaseStage.OPD_SCHEDULED]: 1,
  [CaseStage.OPD_DONE]: 2,
  [CaseStage.KYP_BASIC_COMPLETE]: 3,
  [CaseStage.HOSPITALS_SUGGESTED]: 4,
  [CaseStage.PREAUTH_RAISED]: 5,
  [CaseStage.PREAUTH_COMPLETE]: 6,
  [CaseStage.INITIATED]: 7,
  [CaseStage.DISCHARGED]: 9,
  [CaseStage.KYP_BASIC_PENDING]: 2,
  [CaseStage.KYP_DETAILED_PENDING]: 4,
  [CaseStage.KYP_DETAILED_COMPLETE]: 4,
  [CaseStage.KYP_PENDING]: 2,
  [CaseStage.KYP_COMPLETE]: 4,
  [CaseStage.ADMITTED]: 7,
  [CaseStage.IPD_DONE]: 8,
  [CaseStage.PL_PENDING]: 9,
  [CaseStage.OUTSTANDING]: 9,
}

export const INSURANCE_WORKFLOW_STEPS: WorkflowResetStepDef[] = [
  { number: 1, label: 'OPD Schedule', shortLabel: 'OPD Schedule', owner: 'BD' },
  { number: 2, label: 'OPD Done', shortLabel: 'OPD Done', owner: 'BD' },
  { number: 3, label: 'Insurance Card Details', shortLabel: 'Card Details', owner: 'BD' },
  { number: 4, label: 'Suggest Hospitals', shortLabel: 'Hospitals', owner: 'INSURANCE' },
  { number: 5, label: 'Pre-Auth Raise', shortLabel: 'Pre-Auth Raise', owner: 'BD' },
  { number: 6, label: 'Pre-Auth Approval', shortLabel: 'PA Approval', owner: 'INSURANCE' },
  { number: 7, label: 'Insurance Initial Form', shortLabel: 'Initial Form', owner: 'INSURANCE' },
  { number: 8, label: 'IPD Details', shortLabel: 'IPD Details', owner: 'BD' },
  { number: 9, label: 'IPD Mark', shortLabel: 'IPD Mark', owner: 'BD' },
  { number: 10, label: 'Discharge Summary', shortLabel: 'Discharge', owner: 'INSURANCE' },
]

export const CASH_WORKFLOW_STEPS: WorkflowResetStepDef[] = [
  { number: 1, label: 'OPD Schedule', shortLabel: 'OPD Schedule', owner: 'BD' },
  { number: 2, label: 'OPD Done', shortLabel: 'OPD Done', owner: 'BD' },
  { number: 3, label: 'IPD Cash Form', shortLabel: 'IPD Form', owner: 'BD' },
  { number: 4, label: 'Insurance Review', shortLabel: 'Review', owner: 'INSURANCE' },
  { number: 5, label: 'Approved', shortLabel: 'Approved', owner: 'INSURANCE' },
  { number: 6, label: 'IPD Done', shortLabel: 'IPD Done', owner: 'BD' },
  { number: 7, label: 'Discharge', shortLabel: 'Discharge', owner: 'INSURANCE' },
]

const CASH_STAGE_ORDER: Partial<Record<CaseStage, number>> = {
  [CaseStage.CASH_IPD_PENDING]: 0,
  [CaseStage.CASH_OPD_SCHEDULED]: 1,
  [CaseStage.CASH_OPD_DONE]: 2,
  [CaseStage.CASH_IPD_SUBMITTED]: 3,
  [CaseStage.CASH_ON_HOLD]: 3,
  [CaseStage.CASH_APPROVED]: 4,
  [CaseStage.CASH_IPD_DONE]: 5,
  [CaseStage.CASH_DISCHARGED]: 6,
}

function insuranceStepDone(step: number, stageIndex: number, extras: WorkflowStepExtras): boolean {
  switch (step) {
    case 1:
      return stageIndex >= 1 || extras.hasOpdScheduled
    case 2:
      return stageIndex >= 2 || extras.hasOpdDone
    case 3:
      return extras.hasOpdDone && stageIndex >= 3
    case 4:
      return extras.hasOpdDone && stageIndex >= 4
    case 5:
      return extras.hasOpdDone && stageIndex >= 5
    case 6:
      return extras.hasOpdDone && stageIndex >= 6 && extras.hasInitiateForm
    case 7:
      return extras.hasOpdDone && stageIndex >= 7
    case 8:
      return extras.hasOpdDone && stageIndex >= 7 && extras.hasIpdMark
    case 9:
      return extras.hasOpdDone && stageIndex >= 8
    case 10:
      return extras.hasOpdDone && stageIndex >= 9
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

export function getCashCurrentStep(stage: CaseStage, extras: WorkflowStepExtras): number {
  const idx = CASH_STAGE_ORDER[stage] ?? 0
  for (const step of CASH_WORKFLOW_STEPS) {
    if (!cashStepDone(step.number, idx, extras)) return step.number
  }
  return CASH_WORKFLOW_STEPS.length
}

export function getWorkflowSteps(flowType: FlowType | null | undefined): WorkflowResetStepDef[] {
  return flowType === FlowType.CASH ? CASH_WORKFLOW_STEPS : INSURANCE_WORKFLOW_STEPS
}

export function getCurrentWorkflowStep(
  flowType: FlowType | null | undefined,
  stage: CaseStage,
  extras: WorkflowStepExtras,
): number {
  if (flowType === FlowType.CASH) return getCashCurrentStep(stage, extras)
  return getInsuranceCurrentStep(stage, extras)
}

function cashStepDone(step: number, stageIndex: number, extras: WorkflowStepExtras): boolean {
  switch (step) {
    case 1:
      return stageIndex >= 1 || extras.hasOpdScheduled
    case 2:
      return stageIndex >= 2 || extras.hasOpdDone
    case 3:
      return extras.hasOpdDone && stageIndex >= 3
    case 4:
      return extras.hasOpdDone && stageIndex >= 4
    case 5:
      return extras.hasOpdDone && stageIndex >= 5
    case 6:
      return extras.hasOpdDone && stageIndex >= 6
    case 7:
      return extras.hasOpdDone && stageIndex >= 6
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
        ? cashStepDone(step.number, stageIndex, extras)
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
          clearOpdSchedule: true,
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
          caseStage: CaseStage.CASH_OPD_SCHEDULED,
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
          resetLeadStatus: 'OPD Schedule',
        }
      case 3:
        return {
          caseStage: CaseStage.CASH_OPD_DONE,
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
          resetLeadStatus: 'OPD Done',
        }
      case 4:
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
      case 5:
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
      case 6:
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
      case 7:
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
        caseStage: CaseStage.OPD_SCHEDULED,
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
        resetLeadStatus: 'OPD Schedule',
      }
    case 3:
      return {
        caseStage: CaseStage.OPD_DONE,
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
        resetLeadStatus: 'OPD Done',
      }
    case 4:
      return {
        caseStage: CaseStage.KYP_BASIC_COMPLETE,
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
    case 6:
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
    case 7:
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
    case 8:
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
    case 9:
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
    case 10:
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
  switch (step.shortLabel) {
    case 'OPD Schedule':
      return `/patient/${leadId}/opd-schedule`
    case 'Card Details':
      return `/patient/${leadId}/kyp/basic`
    case 'IPD Form':
      return `/patient/${leadId}?action=ipd-cash`
    case 'Hospitals':
    case 'PA Approval':
      return `/patient/${leadId}/pre-auth`
    case 'Pre-Auth Raise':
      return `/patient/${leadId}/raise-preauth`
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
