"use client"

import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Pencil, Star } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  useUpdateComplianceCall,
  type ComplianceCall,
  type ComplianceCallStatus,
} from "@/hooks/use-compliance-calls"
import { QRCodePopover } from "./qr-code-popover"

const STATUS_OPTIONS: { value: ComplianceCallStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DID_NOT_PICK", label: "Did not pick" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
  { value: "CALLBACK_SCHEDULED", label: "Callback scheduled" },
]

const STATUS_ACCENT: Record<ComplianceCallStatus, string> = {
  PENDING: "border-l-amber-400",
  COMPLETED: "border-l-emerald-500",
  DID_NOT_PICK: "border-l-rose-400",
  WRONG_NUMBER: "border-l-rose-500",
  CALLBACK_SCHEDULED: "border-l-sky-400",
}

interface Props {
  call: ComplianceCall
  onEdit: (call: ComplianceCall) => void
}

export function ComplianceCallRow({ call, onEdit }: Props) {
  const router = useRouter()
  const update = useUpdateComplianceCall()
  const bdmName = call.lead.dischargeSheet?.bdmName
  const dischargeDate = call.lead.dischargeSheet?.dischargeDate

  const handleStatusChange = async (next: ComplianceCallStatus) => {
    if (next === call.status) return
    if (next === "COMPLETED") {
      // Need rating + notes — route through edit drawer
      onEdit(call)
      return
    }
    try {
      await update.mutateAsync({ id: call.id, status: next })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    }
  }

  const openPatient = () => router.push(`/patient/${call.leadId}`)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPatient}
      onKeyDown={(e) => {
        if (e.key === "Enter") openPatient()
      }}
      className={cn(
        "border-l-4 px-4 py-3 hover:bg-muted/40 transition cursor-pointer",
        STATUS_ACCENT[call.status],
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium truncate">{call.lead.patientName}</p>
            {call.rating != null && (
              <span className="inline-flex items-center gap-0.5 text-amber-500">
                {Array.from({ length: call.rating }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {call.lead.treatment ?? "—"} · {call.lead.hospitalName}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            BD {call.lead.bd?.name ?? "—"}
            {bdmName ? ` · BDM ${bdmName}` : ""}
            {dischargeDate
              ? ` · Discharged ${format(new Date(dischargeDate), "d MMM")}`
              : ""}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <QRCodePopover phoneNumber={call.lead.phoneNumber} patientName={call.lead.patientName} />
          <Select
            value={call.status}
            onValueChange={(v) => handleStatusChange(v as ComplianceCallStatus)}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => onEdit(call)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {call.rating ? "Edit rating" : "Add rating"}
          </Button>
        </div>
      </div>

      {call.notes && (
        <p className="mt-2 text-xs text-muted-foreground italic line-clamp-2">
          &ldquo;{call.notes}&rdquo;
        </p>
      )}
    </div>
  )
}
