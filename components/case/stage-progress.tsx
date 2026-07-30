'use client'

import { CaseStage } from '@/generated/prisma/enums'
import { cn } from '@/lib/utils'
import { CheckCircle2, Clock } from 'lucide-react'

// ─── Step definitions matching the insurance workflow ───────────────────────

type StepOwner = 'BD' | 'INSURANCE'

interface WorkflowStep {
  number: number
  label: string
  shortLabel: string
  owner: StepOwner
  /** Returns true when this step has been completed */
  isDone: (stageIndex: number, extras: StepExtras) => boolean
}

interface StepExtras {
  hasOpdScheduled: boolean
  hasOpdDone: boolean
  hasInitiateForm: boolean
  hasIpdMark: boolean
}

// Map active CaseStage values to a linear index for ordering
const STAGE_ORDER: Partial<Record<CaseStage, number>> = {
  [CaseStage.NEW_LEAD]: 0,
  [CaseStage.OPD_SCHEDULED]: 1,
  [CaseStage.OPD_DONE]: 2,
  [CaseStage.KYP_BASIC_COMPLETE]: 3,
  [CaseStage.HOSPITALS_SUGGESTED]: 4,
  [CaseStage.PREAUTH_RAISED]: 5,
  [CaseStage.PREAUTH_COMPLETE]: 6,
  [CaseStage.INITIATED]: 7,
  [CaseStage.DISCHARGED]: 9,
  // Legacy mappings
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

function getStageIndex(stage: CaseStage): number {
  return STAGE_ORDER[stage] ?? 0
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    number: 1,
    label: 'OPD Schedule',
    shortLabel: 'OPD Schedule',
    owner: 'BD',
    isDone: (si, ex) => si >= 1 || ex.hasOpdScheduled,
  },
  {
    number: 2,
    label: 'OPD Done',
    shortLabel: 'OPD Done',
    owner: 'BD',
    isDone: (si, ex) => si >= 2 || ex.hasOpdDone,
  },
  {
    number: 3,
    label: 'Insurance Card Details',
    shortLabel: 'Card Details',
    owner: 'BD',
    isDone: (si, ex) => si >= 3 || ex.hasOpdDone,
  },
  {
    number: 4,
    label: 'Suggest Hospitals',
    shortLabel: 'Hospitals',
    owner: 'INSURANCE',
    isDone: (si, ex) => ex.hasOpdDone && si >= 3,
  },
  {
    number: 5,
    label: 'Pre-Auth Raise',
    shortLabel: 'Pre-Auth Raise',
    owner: 'BD',
    isDone: (si, ex) => ex.hasOpdDone && si >= 4,
  },
  {
    number: 6,
    label: 'Pre-Auth Approval',
    shortLabel: 'PA Approval',
    owner: 'INSURANCE',
    isDone: (si, ex) => ex.hasOpdDone && si >= 5,
  },
  {
    number: 7,
    label: 'Insurance Initial Form',
    shortLabel: 'Initial Form',
    owner: 'INSURANCE',
    isDone: (si, ex) => ex.hasOpdDone && si >= 6 && ex.hasInitiateForm,
  },
  {
    number: 8,
    label: 'IPD Details',
    shortLabel: 'IPD Details',
    owner: 'BD',
    isDone: (si, ex) => ex.hasOpdDone && si >= 7,
  },
  {
    number: 9,
    label: 'IPD Mark',
    shortLabel: 'IPD Mark',
    owner: 'BD',
    isDone: (si, ex) => ex.hasOpdDone && si >= 7 && ex.hasIpdMark,
  },
  {
    number: 10,
    label: 'Discharge Summary',
    shortLabel: 'Discharge',
    owner: 'INSURANCE',
    isDone: (si, ex) => ex.hasOpdDone && si >= 8,
  },
]

function isInsuranceWorkflowComplete(stage: CaseStage) {
  return (
    stage === CaseStage.DISCHARGED ||
    stage === CaseStage.PL_PENDING ||
    stage === CaseStage.OUTSTANDING
  )
}

function getCurrentStep(currentStage: CaseStage, extras: StepExtras): number {
  switch (currentStage) {
    case CaseStage.NEW_LEAD:
      return extras.hasOpdDone ? 3 : extras.hasOpdScheduled ? 2 : 1
    case CaseStage.OPD_SCHEDULED:
      return 2
    case CaseStage.OPD_DONE:
    case CaseStage.KYP_BASIC_PENDING:
    case CaseStage.KYP_PENDING:
      return 3
    case CaseStage.KYP_BASIC_COMPLETE:
      return 4
    case CaseStage.HOSPITALS_SUGGESTED:
    case CaseStage.KYP_DETAILED_PENDING:
    case CaseStage.KYP_DETAILED_COMPLETE:
    case CaseStage.KYP_COMPLETE:
      return 5
    case CaseStage.PREAUTH_RAISED:
      return 6
    case CaseStage.PREAUTH_COMPLETE:
      return extras.hasInitiateForm ? 8 : 7
    case CaseStage.INITIATED:
    case CaseStage.ADMITTED:
      return extras.hasIpdMark ? 10 : 9
    case CaseStage.IPD_DONE:
      return 10
    case CaseStage.DISCHARGED:
    case CaseStage.PL_PENDING:
    case CaseStage.OUTSTANDING:
      return WORKFLOW_STEPS.length
    default: {
      const stageIndex = getStageIndex(currentStage)
      for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
        if (!WORKFLOW_STEPS[i].isDone(stageIndex, extras)) return i + 1
      }
      return WORKFLOW_STEPS.length
    }
  }
}

// ─── Colour helpers ──────────────────────────────────────────────────────────

const BD_COLORS = {
  dot: 'bg-blue-500',
  dotCurrent: 'bg-blue-500 ring-4 ring-blue-200 dark:ring-blue-900',
  text: 'text-blue-700 dark:text-blue-300',
  badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  connector: 'bg-blue-400',
}

const INS_COLORS = {
  dot: 'bg-orange-500',
  dotCurrent: 'bg-orange-500 ring-4 ring-orange-200 dark:ring-orange-900',
  text: 'text-orange-700 dark:text-orange-300',
  badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  connector: 'bg-orange-400',
}

const DONE_COLORS = {
  dot: 'bg-green-500',
  text: 'text-green-700 dark:text-green-400',
  connector: 'bg-green-400',
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface StageProgressProps {
  currentStage: CaseStage
  hasOpdScheduled?: boolean
  hasOpdDone?: boolean
  hasInitiateForm?: boolean
  hasIpdMark?: boolean
  compact?: boolean
  className?: string
}

// ─── Full progress bar (patient page) ────────────────────────────────────────

export function StageProgress({
  currentStage,
  hasOpdScheduled = false,
  hasOpdDone = false,
  hasInitiateForm = false,
  hasIpdMark = false,
  compact = false,
  className,
}: StageProgressProps) {
  const extras: StepExtras = { hasOpdScheduled, hasOpdDone, hasInitiateForm, hasIpdMark }
  const currentStepNumber = getCurrentStep(currentStage, extras)
  const allDone = isInsuranceWorkflowComplete(currentStage)

  if (compact) {
    return (
      <StageProgressCompact
        currentStepNumber={currentStepNumber}
        allDone={allDone}
        className={className}
      />
    )
  }

  return (
    <div className={cn('w-full select-none', className)}>
      {/* Step row */}
      <div className="relative flex items-start">
        {/* Background connector line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 dark:bg-gray-700 z-0" />

        {WORKFLOW_STEPS.map((step, idx) => {
          const done = allDone || step.number < currentStepNumber
          const isCurrent = step.number === currentStepNumber
          const colors = step.owner === 'BD' ? BD_COLORS : INS_COLORS
          const isLast = idx === WORKFLOW_STEPS.length - 1
          const nextDone =
            idx < WORKFLOW_STEPS.length - 1 &&
            (allDone || WORKFLOW_STEPS[idx + 1].number < currentStepNumber)

          return (
            <div key={step.number} className="relative flex flex-col items-center flex-1 z-10">
              {/* Connector to next step */}
              {!isLast && (
                <div
                  className={cn(
                    'absolute top-4 left-1/2 right-0 h-0.5 z-0',
                    done && nextDone ? DONE_COLORS.connector : done ? colors.connector : 'bg-gray-200 dark:bg-gray-700'
                  )}
                  style={{ width: '100%' }}
                />
              )}

              {/* Dot */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all duration-300',
                  done
                    ? `${DONE_COLORS.dot} shadow-sm`
                    : isCurrent
                    ? `${colors.dotCurrent} animate-pulse`
                    : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : isCurrent ? (
                  <Clock className="w-3.5 h-3.5 text-white" />
                ) : (
                  <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">{step.number}</span>
                )}
              </div>

              {/* Label + owner badge */}
              <div className="mt-2 flex flex-col items-center gap-1 text-center px-0.5">
                <span
                  className={cn(
                    'text-[10px] font-semibold leading-tight',
                    done ? DONE_COLORS.text : isCurrent ? colors.text : 'text-gray-400 dark:text-gray-600'
                  )}
                >
                  {step.shortLabel}
                </span>
                <span
                  className={cn(
                    'text-[9px] px-1 py-0.5 rounded font-medium leading-none',
                    done || isCurrent ? colors.badge : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                  )}
                >
                  {step.owner}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Current step label */}
      <div className="mt-3 flex items-center justify-center gap-2">
        {(() => {
          const step = WORKFLOW_STEPS[currentStepNumber - 1]
          if (!step) return null
          const colors = step.owner === 'BD' ? BD_COLORS : INS_COLORS
          return (
            <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', colors.badge)}>
              {allDone ? '✓ Case Complete' : `Step ${step.number}: ${step.label}`}
            </span>
          )
        })()}
      </div>
    </div>
  )
}

// ─── Compact version (pipeline rows) ────────────────────────────────────────

function StageProgressCompact({
  currentStepNumber,
  allDone,
  className,
}: {
  currentStepNumber: number
  allDone: boolean
  className?: string
}) {
  const currentStep = WORKFLOW_STEPS[currentStepNumber - 1]
  const colors = currentStep?.owner === 'BD' ? BD_COLORS : INS_COLORS

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* Mini dot track */}
      <div className="flex items-center gap-0.5">
        {WORKFLOW_STEPS.map((step) => {
          const done = allDone || step.number < currentStepNumber
          const isCurrent = step.number === currentStepNumber
          const stepColors = step.owner === 'BD' ? BD_COLORS : INS_COLORS
          return (
            <div
              key={step.number}
              title={`Step ${step.number}: ${step.label} (${step.owner})`}
              className={cn(
                'rounded-full transition-all',
                done
                  ? `h-2 w-2 ${DONE_COLORS.dot}`
                  : isCurrent
                  ? `h-2.5 w-2.5 ${stepColors.dot} animate-pulse`
                  : 'h-2 w-2 bg-gray-200 dark:bg-gray-700'
              )}
            />
          )
        })}
      </div>
      {/* Step label */}
      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit', colors.badge)}>
        {allDone ? '✓ Complete' : `Step ${currentStepNumber}: ${currentStep?.shortLabel}`}
      </span>
    </div>
  )
}
