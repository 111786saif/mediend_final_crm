"use client"

import { format } from "date-fns"
import { Star } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  CONCERN_CATEGORY_LABEL,
  useComplianceCall,
  type ComplianceCall,
} from "@/hooks/use-compliance-calls"

interface Props {
  callId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SATISFACTION_TONE: Record<string, string> = {
  SATISFIED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  NEUTRAL: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  NOT_SATISFIED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
}

const SATISFACTION_LABEL: Record<string, string> = {
  SATISFIED: "Satisfied",
  NEUTRAL: "Neutral",
  NOT_SATISFIED: "Not satisfied",
}

export function FeedbackDetailDialog({ callId, open, onOpenChange }: Props) {
  const { data, isLoading } = useComplianceCall(callId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {data?.lead.patientName ?? "Patient feedback"}
            {data?.lead.leadRef && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                {data.lead.leadRef}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <FeedbackBody call={data} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FeedbackBody({ call }: { call: ComplianceCall }) {
  const dischargeDate = call.lead.dischargeSheet?.dischargeDate
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {call.rating != null && (
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={cn(
                  "h-4 w-4",
                  n <= call.rating!
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30",
                )}
              />
            ))}
          </div>
        )}
        {call.satisfaction && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              SATISFACTION_TONE[call.satisfaction],
            )}
          >
            {SATISFACTION_LABEL[call.satisfaction]}
          </span>
        )}
        {call.concernCategories.map((c) => (
          <span
            key={c}
            className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"
          >
            {CONCERN_CATEGORY_LABEL[c]}
          </span>
        ))}
      </div>

      <Group title="Patient & case">
        <Pair label="Treatment" value={call.lead.treatment} />
        <Pair label="Hospital" value={call.lead.hospitalName} />
        <Pair label="Surgeon" value={call.lead.surgeonName} />
        <Pair
          label="Date of surgery"
          value={
            call.lead.surgeryDate
              ? format(new Date(call.lead.surgeryDate), "dd MMM yyyy")
              : null
          }
        />
        <Pair
          label="Discharge date"
          value={dischargeDate ? format(new Date(dischargeDate), "dd MMM yyyy") : null}
        />
        <Pair label="BD" value={call.lead.bd?.name ?? null} />
        <Pair label="BDM" value={call.lead.dischargeSheet?.bdmName ?? null} />
        <Pair label="Manager" value={call.lead.dischargeSheet?.managerName ?? null} />
      </Group>

      <Group title="Patient experience">
        <Pair label="Problem during surgery" value={call.problemDuringSurgery} />
        <Pair label="Problem after surgery" value={call.problemAfterSurgery} />
        <Pair label="Commitment & status" value={call.commitmentStatus} />
        <Pair label="Concern resolved" value={call.concernResolved} />
      </Group>

      <Group title="Service quality">
        <Pair label="Doctor behaviour" value={call.doctorBehaviour} />
        <Pair label="Hospital & staff behaviour" value={call.hospitalStaffBehaviour} />
        <Pair label="BDM behaviour" value={call.bdmBehaviour} />
        <Pair label="Service of MediEND" value={call.mediendService} />
        <Pair label="Overall experience" value={call.overallExperience} />
      </Group>

      <Group title="Payment & referral">
        <Pair label="Payment query" value={call.paymentQuery} />
        <Pair label="Referral confirmation" value={call.referralConfirmation} />
        <Pair label="Referral name" value={call.referralName} />
        <Pair label="Referral contact" value={call.referralContact} />
      </Group>

      <Group title="OPD follow-up">
        <Pair label="OPD" value={call.opdStatus} />
        <Pair label="Mode of OPD" value={call.opdMode} />
      </Group>

      {(call.additionalRemark || call.notes) && (
        <Group title="Remarks & notes">
          {call.additionalRemark && (
            <Pair label="Additional remark" value={call.additionalRemark} block />
          )}
          {call.notes && <Pair label="General notes" value={call.notes} block />}
        </Group>
      )}
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 rounded-lg border bg-card/40 p-3">
        {children}
      </div>
    </section>
  )
}

function Pair({
  label,
  value,
  block,
}: {
  label: string
  value: string | null | undefined
  block?: boolean
}) {
  const empty = !value
  return (
    <div className={cn("flex flex-col gap-0.5", block && "sm:col-span-2")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm",
          empty ? "text-muted-foreground/50" : "text-foreground",
          block && "whitespace-pre-wrap",
        )}
      >
        {empty ? "—" : value}
      </span>
    </div>
  )
}
