"use client"

import { useEffect, useState } from "react"
import { Star, X } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  CONCERN_CATEGORIES,
  CONCERN_CATEGORY_LABEL,
  useUpdateComplianceCall,
  type ComplianceCall,
  type ComplianceCallStatus,
  type ConcernCategory,
  type SatisfactionLevel,
} from "@/hooks/use-compliance-calls"

const RATINGS = [1, 2, 3, 4, 5] as const

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Below average",
  3: "Average",
  4: "Good",
  5: "Excellent",
}

const RATING_COLORS: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-amber-500",
  4: "text-emerald-500",
  5: "text-emerald-600",
}

const STATUS_OPTIONS: { value: ComplianceCallStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DID_NOT_PICK", label: "Did not pick" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
  { value: "CALLBACK_SCHEDULED", label: "Callback scheduled" },
]

const SATISFACTION_OPTIONS: { value: SatisfactionLevel; label: string; tone: string }[] = [
  { value: "SATISFIED", label: "Satisfied", tone: "bg-emerald-600 text-white" },
  { value: "NEUTRAL", label: "Neutral", tone: "bg-amber-500 text-white" },
  { value: "NOT_SATISFIED", label: "Not satisfied", tone: "bg-red-600 text-white" },
]

interface FormState {
  status: ComplianceCallStatus
  rating: number | null
  satisfaction: SatisfactionLevel | null
  callbackAt: string

  problemDuringSurgery: string
  problemAfterSurgery: string
  commitmentStatus: string
  concernResolved: string

  doctorBehaviour: string
  hospitalStaffBehaviour: string
  bdmBehaviour: string
  mediendService: string
  overallExperience: string

  paymentQuery: string
  referralConfirmation: string
  referralName: string
  referralContact: string

  opdStatus: string
  opdMode: string

  additionalRemark: string
  notes: string

  concernCategories: ConcernCategory[]
}

function emptyState(): FormState {
  return {
    status: "PENDING",
    rating: null,
    satisfaction: null,
    callbackAt: "",
    problemDuringSurgery: "",
    problemAfterSurgery: "",
    commitmentStatus: "",
    concernResolved: "",
    doctorBehaviour: "",
    hospitalStaffBehaviour: "",
    bdmBehaviour: "",
    mediendService: "",
    overallExperience: "",
    paymentQuery: "",
    referralConfirmation: "",
    referralName: "",
    referralContact: "",
    opdStatus: "",
    opdMode: "",
    additionalRemark: "",
    notes: "",
    concernCategories: [],
  }
}

function fromCall(call: ComplianceCall): FormState {
  return {
    status: call.status,
    rating: call.rating,
    satisfaction: call.satisfaction,
    callbackAt: call.callbackAt ? call.callbackAt.slice(0, 16) : "",
    problemDuringSurgery: call.problemDuringSurgery ?? "",
    problemAfterSurgery: call.problemAfterSurgery ?? "",
    commitmentStatus: call.commitmentStatus ?? "",
    concernResolved: call.concernResolved ?? "",
    doctorBehaviour: call.doctorBehaviour ?? "",
    hospitalStaffBehaviour: call.hospitalStaffBehaviour ?? "",
    bdmBehaviour: call.bdmBehaviour ?? "",
    mediendService: call.mediendService ?? "",
    overallExperience: call.overallExperience ?? "",
    paymentQuery: call.paymentQuery ?? "",
    referralConfirmation: call.referralConfirmation ?? "",
    referralName: call.referralName ?? "",
    referralContact: call.referralContact ?? "",
    opdStatus: call.opdStatus ?? "",
    opdMode: call.opdMode ?? "",
    additionalRemark: call.additionalRemark ?? "",
    notes: call.notes ?? "",
    concernCategories: call.concernCategories ?? [],
  }
}

interface Props {
  call: ComplianceCall | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ComplianceFeedbackDrawer({ call, open, onOpenChange }: Props) {
  const update = useUpdateComplianceCall()
  const [state, setState] = useState<FormState>(emptyState)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    if (call) setState(fromCall(call))
    else setState(emptyState())
  }, [call])

  if (!call) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl" />
      </Sheet>
    )
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((s) => ({ ...s, [key]: value }))

  const toggleConcern = (cat: ConcernCategory) =>
    setState((s) => ({
      ...s,
      concernCategories: s.concernCategories.includes(cat)
        ? s.concernCategories.filter((c) => c !== cat)
        : [...s.concernCategories, cat],
    }))

  const onSubmit = async () => {
    if (state.status === "COMPLETED" && !state.rating) {
      toast.error("Rating is required to mark this call completed")
      return
    }
    if (state.status === "CALLBACK_SCHEDULED" && !state.callbackAt) {
      toast.error("Pick a callback date/time")
      return
    }
    try {
      await update.mutateAsync({
        id: call.id,
        status: state.status,
        rating: state.rating,
        satisfaction: state.satisfaction,
        callbackAt: state.callbackAt ? new Date(state.callbackAt).toISOString() : null,
        problemDuringSurgery: state.problemDuringSurgery.trim() || null,
        problemAfterSurgery: state.problemAfterSurgery.trim() || null,
        commitmentStatus: state.commitmentStatus.trim() || null,
        concernResolved: state.concernResolved.trim() || null,
        doctorBehaviour: state.doctorBehaviour.trim() || null,
        hospitalStaffBehaviour: state.hospitalStaffBehaviour.trim() || null,
        bdmBehaviour: state.bdmBehaviour.trim() || null,
        mediendService: state.mediendService.trim() || null,
        overallExperience: state.overallExperience.trim() || null,
        paymentQuery: state.paymentQuery.trim() || null,
        referralConfirmation: state.referralConfirmation.trim() || null,
        referralName: state.referralName.trim() || null,
        referralContact: state.referralContact.trim() || null,
        opdStatus: state.opdStatus.trim() || null,
        opdMode: state.opdMode.trim() || null,
        additionalRemark: state.additionalRemark.trim() || null,
        notes: state.notes.trim() || null,
        concernCategories: state.concernCategories,
      })
      toast.success("Feedback saved")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    }
  }

  const ratingDisplay = hover ?? state.rating

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-base">
            {call.lead.patientName}
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              {call.lead.leadRef}
            </span>
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            {call.lead.treatment ?? "—"} · {call.lead.hospitalName}
            {call.lead.surgeryDate && (
              <> · DOS {format(new Date(call.lead.surgeryDate), "dd MMM yyyy")}</>
            )}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <Section title="Status & rating">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={state.status}
                  onValueChange={(v) => set("status", v as ComplianceCallStatus)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {state.status === "CALLBACK_SCHEDULED" && (
                <div>
                  <Label className="text-xs">Callback at</Label>
                  <Input
                    type="datetime-local"
                    className="mt-1"
                    value={state.callbackAt}
                    onChange={(e) => set("callbackAt", e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="mt-4">
              <Label className="text-xs">Rating</Label>
              <div className="flex items-center gap-1 mt-1">
                {RATINGS.map((r) => {
                  const filled = ratingDisplay != null && r <= ratingDisplay
                  return (
                    <button
                      key={r}
                      type="button"
                      onMouseEnter={() => setHover(r)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => set("rating", r)}
                      aria-label={`${r} of 5`}
                      className="p-1.5 transition active:scale-95"
                    >
                      <Star
                        className={cn(
                          "h-7 w-7 transition",
                          filled
                            ? RATING_COLORS[ratingDisplay!]
                            : "text-muted-foreground/40",
                          filled && "fill-current",
                        )}
                      />
                    </button>
                  )
                })}
                {ratingDisplay != null && (
                  <span
                    className={cn(
                      "ml-2 text-sm font-medium",
                      RATING_COLORS[ratingDisplay],
                    )}
                  >
                    {RATING_LABELS[ratingDisplay]}
                  </span>
                )}
                {state.rating != null && (
                  <button
                    type="button"
                    onClick={() => set("rating", null)}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4">
              <Label className="text-xs">Satisfaction</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {SATISFACTION_OPTIONS.map((s) => {
                  const active = state.satisfaction === s.value
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() =>
                        set("satisfaction", active ? null : s.value)
                      }
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition",
                        active
                          ? s.tone
                          : "bg-muted text-muted-foreground hover:bg-muted/80",
                      )}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </Section>

          <Section title="Patient experience">
            <Field label="Problem during the surgery">
              <Textarea
                rows={2}
                value={state.problemDuringSurgery}
                onChange={(e) => set("problemDuringSurgery", e.target.value)}
                placeholder="e.g. no / busy / not connected"
              />
            </Field>
            <Field label="Problem after the surgery">
              <Textarea
                rows={2}
                value={state.problemAfterSurgery}
                onChange={(e) => set("problemAfterSurgery", e.target.value)}
                placeholder="e.g. swelling, bleeding, stitch open"
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Commitment & status">
                <Input
                  value={state.commitmentStatus}
                  onChange={(e) => set("commitmentStatus", e.target.value)}
                  placeholder="all complete / not all"
                />
              </Field>
              <Field label="Concern resolved">
                <Input
                  value={state.concernResolved}
                  onChange={(e) => set("concernResolved", e.target.value)}
                  placeholder="yes / pending / no"
                />
              </Field>
            </div>
          </Section>

          <Section title="Service quality">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Doctor behaviour">
                <Input
                  value={state.doctorBehaviour}
                  onChange={(e) => set("doctorBehaviour", e.target.value)}
                />
              </Field>
              <Field label="Hospital & staff behaviour">
                <Input
                  value={state.hospitalStaffBehaviour}
                  onChange={(e) => set("hospitalStaffBehaviour", e.target.value)}
                />
              </Field>
              <Field label="BDM behaviour">
                <Input
                  value={state.bdmBehaviour}
                  onChange={(e) => set("bdmBehaviour", e.target.value)}
                />
              </Field>
              <Field label="Service of MediEND">
                <Input
                  value={state.mediendService}
                  onChange={(e) => set("mediendService", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Overall experience with MediEND">
              <Input
                value={state.overallExperience}
                onChange={(e) => set("overallExperience", e.target.value)}
                placeholder="satisfied / recovery on going / biopsy report pending"
              />
            </Field>
          </Section>

          <Section title="Payment & referral">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Payment-related query">
                <Input
                  value={state.paymentQuery}
                  onChange={(e) => set("paymentQuery", e.target.value)}
                />
              </Field>
              <Field label="Referral confirmation">
                <Input
                  value={state.referralConfirmation}
                  onChange={(e) => set("referralConfirmation", e.target.value)}
                  placeholder="social media / done"
                />
              </Field>
              <Field label="Referral name">
                <Input
                  value={state.referralName}
                  onChange={(e) => set("referralName", e.target.value)}
                />
              </Field>
              <Field label="Referral contact">
                <Input
                  value={state.referralContact}
                  onChange={(e) => set("referralContact", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section title="OPD follow-up">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="OPD">
                <Input
                  list="opd-status-list"
                  value={state.opdStatus}
                  onChange={(e) => set("opdStatus", e.target.value)}
                  placeholder="done / not done"
                />
                <datalist id="opd-status-list">
                  <option value="done" />
                  <option value="not done" />
                </datalist>
              </Field>
              <Field label="Mode of OPD">
                <Input
                  list="opd-mode-list"
                  value={state.opdMode}
                  onChange={(e) => set("opdMode", e.target.value)}
                  placeholder="visit / online"
                />
                <datalist id="opd-mode-list">
                  <option value="visit" />
                  <option value="online" />
                </datalist>
              </Field>
            </div>
          </Section>

          <Section title="Concerns raised">
            <div className="flex flex-wrap gap-2">
              {CONCERN_CATEGORIES.map((cat) => {
                const active = state.concernCategories.includes(cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleConcern(cat)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition border",
                      active
                        ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                        : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80",
                    )}
                  >
                    {active && <X className="inline h-3 w-3 -ml-0.5 mr-1" />}
                    {CONCERN_CATEGORY_LABEL[cat]}
                  </button>
                )
              })}
            </div>
            {state.concernCategories.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                No concerns ticked. Tick categories the patient raised — drives the monthly report.
              </p>
            )}
          </Section>

          <Section title="Additional remarks">
            <Textarea
              rows={3}
              value={state.additionalRemark}
              onChange={(e) => set("additionalRemark", e.target.value)}
              placeholder="Anything else the patient mentioned"
            />
          </Section>

          <Section title="General notes">
            <Textarea
              rows={3}
              value={state.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Internal notes for the compliance team"
            />
          </Section>
        </div>

        <div className="flex gap-2 border-t px-6 py-4 bg-background">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={onSubmit}
            disabled={update.isPending}
          >
            {update.isPending ? "Saving…" : "Save feedback"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  )
}
