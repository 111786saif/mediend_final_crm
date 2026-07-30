'use client'

import { CaseStage } from '@/generated/prisma/enums'
import { cn } from '@/lib/utils'
import { CheckCircle2, Clock } from 'lucide-react'

// ─── Step definitions matching the cash workflow ────────────────────────────

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
}

// Map active CaseStage values to a linear index for ordering in Cash Flow
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

function getCashStageIndex(stage: CaseStage): number {
  return CASH_STAGE_ORDER[stage] ?? 0
}

function isCashWorkflowComplete(stage: CaseStage) {
  return stage === CaseStage.CASH_DISCHARGED
}

const CASH_WORKFLOW_STEPS: WorkflowStep[] = [
  {
    number: 1,
    label: 'OPD Schedule',
    shortLabel: 'OPD Schedule',
    owner: 'BD',
    isDone: (si, extras) => si >= 1 || extras.hasOpdScheduled,
  },
  {
    number: 2,
    label: 'OPD Done',
    shortLabel: 'OPD Done',
    owner: 'BD',
    isDone: (si, extras) => si >= 2 || extras.hasOpdDone,
  },
  {
    number: 3,
    label: 'IPD Cash Form',
    shortLabel: 'IPD Form',
    owner: 'BD',
    isDone: (si, extras) => si >= 3 || extras.hasOpdDone,
  },
  {
    number: 4,
    label: 'Insurance Review',
    shortLabel: 'Review',
    owner: 'INSURANCE',
    isDone: (si, extras) => extras.hasOpdDone && si >= 4,
  },
  {
    number: 5,
    label: 'Approved',
    shortLabel: 'Approved',
    owner: 'INSURANCE',
    isDone: (si, extras) => extras.hasOpdDone && si >= 5,
  },
  {
    number: 6,
    label: 'IPD Done',
    shortLabel: 'IPD Done',
    owner: 'BD',
    isDone: (si, extras) => extras.hasOpdDone && si >= 6,
  },
  {
    number: 7,
    label: 'Discharge',
    shortLabel: 'Discharge',
    owner: 'INSURANCE',
    isDone: (si, extras) => extras.hasOpdDone && si >= 6,
  },
]

function getCurrentCashStep(currentStage: CaseStage, extras: StepExtras): number {
  switch (currentStage) {
    case CaseStage.CASH_IPD_PENDING:
      return extras.hasOpdDone ? 3 : extras.hasOpdScheduled ? 2 : 1
    case CaseStage.CASH_OPD_SCHEDULED:
      return 2
    case CaseStage.CASH_OPD_DONE:
      return 3
    case CaseStage.CASH_IPD_SUBMITTED:
    case CaseStage.CASH_ON_HOLD:
      return 4
    case CaseStage.CASH_APPROVED:
      return 5
    case CaseStage.CASH_IPD_DONE:
      return 6
    case CaseStage.CASH_DISCHARGED:
      return CASH_WORKFLOW_STEPS.length
    default: {
      const stageIndex = getCashStageIndex(currentStage)
      for (const step of CASH_WORKFLOW_STEPS) {
        if (!step.isDone(stageIndex, extras)) return step.number
      }
      return CASH_WORKFLOW_STEPS.length
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

const HOLD_COLORS = {
  dot: 'bg-amber-500',
  dotCurrent: 'bg-amber-500 ring-4 ring-amber-200 dark:ring-amber-900',
  text: 'text-amber-700 dark:text-amber-300',
  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  connector: 'bg-amber-400',
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface CashStageProgressProps {
  currentStage: CaseStage
  hasOpdScheduled?: boolean
  hasOpdDone?: boolean
  className?: string
}

// ─── Full progress bar (patient page) ────────────────────────────────────────

export function CashStageProgress({
  currentStage,
  hasOpdScheduled = false,
  hasOpdDone = false,
  className,
}: CashStageProgressProps) {
  const extras: StepExtras = { hasOpdScheduled, hasOpdDone }
  const currentStepNumber = getCurrentCashStep(currentStage, extras)
  const isOnHold = currentStage === CaseStage.CASH_ON_HOLD
  const allDone = isCashWorkflowComplete(currentStage)

  return (
    <div className={cn('w-full select-none', className)}>
      {/* Step row */}
      <div className="relative flex items-start">
        {/* Background connector line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 dark:bg-gray-700 z-0" />

        {CASH_WORKFLOW_STEPS.map((step, idx) => {
          const done = allDone || step.number < currentStepNumber
          const isCurrent = step.number === currentStepNumber
          
          // Determine colors
          let colors = step.owner === 'BD' ? BD_COLORS : INS_COLORS
          if (isCurrent && isOnHold && step.number === 4) {
             colors = HOLD_COLORS
          }

          const isLast = idx === CASH_WORKFLOW_STEPS.length - 1
          const nextDone =
            idx < CASH_WORKFLOW_STEPS.length - 1 &&
            (allDone || CASH_WORKFLOW_STEPS[idx + 1].number < currentStepNumber)

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
          const step = CASH_WORKFLOW_STEPS[currentStepNumber - 1]
          if (!step) return null
          
          let colors = step.owner === 'BD' ? BD_COLORS : INS_COLORS
          if (isOnHold && currentStepNumber === 4) {
             colors = HOLD_COLORS
          }

          const label = isOnHold ? 'On Hold (Review Needed)' : `Step ${step.number}: ${step.label}`

          return (
            <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', colors.badge)}>
              {currentStage === CaseStage.CASH_DISCHARGED ? '✓ Case Complete' : label}
            </span>
          )
        })()}
      </div>
    </div>
  )
}
