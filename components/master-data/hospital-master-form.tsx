'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { MasterFileField } from '@/components/master-data/master-file-field'
import {
  PAYMENT_MODE_OPTIONS,
  SERVICE_COVERAGE_OPTIONS,
  type HospitalMasterDetails,
  type PaymentMode,
  type ServiceCoverage,
} from '@/lib/masters/hospital'
import { Plus, Star, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type HospitalFormState = {
  name: string
  address: string
  googleMapLink: string
  mouAgreementUrl: string
  hospitalShare: string
  mediendShare: string
  details: HospitalMasterDetails
  insuranceIds: string[]
  isActive: boolean
}

type InsuranceOption = { id: string; name: string; isActive: boolean }

interface HospitalMasterFormProps {
  form: HospitalFormState
  onChange: (next: HospitalFormState) => void
  insuranceOptions: InsuranceOption[]
  showNameField?: boolean
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {children}
    </div>
  )
}

function MultiCheckGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: ReadonlyArray<{ value: T; label: string }>
  selected: T[]
  onToggle: (value: T, checked: boolean) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((opt) => {
          const checked = selected.includes(opt.value)
          return (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-2 text-sm"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => onToggle(opt.value, v === true)}
              />
              <span>{opt.label}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

export function HospitalMasterForm({
  form,
  onChange,
  insuranceOptions,
  showNameField = true,
}: HospitalMasterFormProps) {
  const patch = (partial: Partial<HospitalFormState>) => onChange({ ...form, ...partial })
  const patchDetails = (partial: Partial<HospitalMasterDetails>) =>
    onChange({ ...form, details: { ...form.details, ...partial } })

  const toggleMode = (value: PaymentMode, checked: boolean) => {
    const prev = form.details.paymentModes ?? []
    patchDetails({
      paymentModes: checked ? [...prev, value] : prev.filter((x) => x !== value),
    })
  }

  const toggleCoverage = (value: ServiceCoverage, checked: boolean) => {
    const prev = form.details.serviceCoverage ?? []
    patchDetails({
      serviceCoverage: checked ? [...prev, value] : prev.filter((x) => x !== value),
    })
  }

  const toggleInsurance = (id: string, checked: boolean) => {
    patch({
      insuranceIds: checked
        ? [...form.insuranceIds, id]
        : form.insuranceIds.filter((x) => x !== id),
    })
  }

  const tracking = form.details.paymentTerms?.trackingEntries ?? []

  return (
    <div className="space-y-4">
      <Section title="1. Hospital Information">
        {showNameField && (
          <div>
            <Label htmlFor="hm-name">Hospital Name *</Label>
            <Input
              id="hm-name"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Display name"
            />
          </div>
        )}
        <div>
          <Label htmlFor="hm-addr">Hospital Address</Label>
          <Textarea
            id="hm-addr"
            value={form.address}
            onChange={(e) => patch({ address: e.target.value })}
            placeholder="Hospital address"
            rows={3}
          />
        </div>
        <div>
          <Label htmlFor="hm-map">Google Maps Link</Label>
          <Input
            id="hm-map"
            value={form.googleMapLink}
            onChange={(e) => patch({ googleMapLink: e.target.value })}
            placeholder="https://maps.google.com/..."
          />
        </div>
        <MasterFileField
          label="MOU Agreement"
          value={form.mouAgreementUrl}
          folder="masters/hospitals/mou"
          onChange={(v) => patch({ mouAgreementUrl: v })}
        />
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="hm-active">Status</Label>
            <p className="text-sm text-muted-foreground">
              {form.isActive
                ? 'Active — shown in dropdowns and forms'
                : 'Inactive — hidden from dropdowns'}
            </p>
          </div>
          <Switch
            id="hm-active"
            checked={form.isActive}
            onCheckedChange={(v) => patch({ isActive: v })}
          />
        </div>
      </Section>

      <Section title="2. Accepted Payment Modes">
        <MultiCheckGroup
          label="Select all that apply"
          options={PAYMENT_MODE_OPTIONS}
          selected={(form.details.paymentModes ?? []) as PaymentMode[]}
          onToggle={toggleMode}
        />
      </Section>

      <Section title="3. Revenue Sharing">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="hm-share">Hospital Share (%)</Label>
            <Input
              id="hm-share"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.hospitalShare}
              onChange={(e) => patch({ hospitalShare: e.target.value })}
              placeholder="e.g. 60"
            />
          </div>
          <div>
            <Label htmlFor="hm-mediend">MEDIAND Share (%)</Label>
            <Input
              id="hm-mediend"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.mediendShare}
              onChange={(e) => patch({ mediendShare: e.target.value })}
              placeholder="e.g. 40"
            />
          </div>
        </div>
      </Section>

      <Section title="4. Service Coverage">
        <MultiCheckGroup
          label="Select all that apply"
          options={SERVICE_COVERAGE_OPTIONS}
          selected={(form.details.serviceCoverage ?? []) as ServiceCoverage[]}
          onToggle={toggleCoverage}
        />
      </Section>

      <Section title="5. Hospital Contact / POC">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="hm-poc-name">Contact Person Name</Label>
            <Input
              id="hm-poc-name"
              value={form.details.contact?.name ?? ''}
              onChange={(e) =>
                patchDetails({
                  contact: { ...form.details.contact, name: e.target.value },
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="hm-poc-phone">Phone Number</Label>
            <Input
              id="hm-poc-phone"
              value={form.details.contact?.phone ?? ''}
              onChange={(e) =>
                patchDetails({
                  contact: { ...form.details.contact, phone: e.target.value },
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="hm-poc-desig">Designation</Label>
            <Input
              id="hm-poc-desig"
              value={form.details.contact?.designation ?? ''}
              onChange={(e) =>
                patchDetails({
                  contact: { ...form.details.contact, designation: e.target.value },
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="hm-poc-dept">Department</Label>
            <Input
              id="hm-poc-dept"
              value={form.details.contact?.department ?? ''}
              onChange={(e) =>
                patchDetails({
                  contact: { ...form.details.contact, department: e.target.value },
                })
              }
            />
          </div>
        </div>
      </Section>

      <Section title="6. Insurance Information">
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
          {insuranceOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No insurance masters yet. Add them under the Insurance tab.
            </p>
          ) : (
            insuranceOptions.map((ins) => {
              const checked = form.insuranceIds.includes(ins.id)
              return (
                <label key={ins.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggleInsurance(ins.id, v === true)}
                  />
                  <span className={!ins.isActive ? 'text-muted-foreground' : ''}>
                    {ins.name}
                    {!ins.isActive ? ' (inactive)' : ''}
                  </span>
                </label>
              )
            })
          )}
        </div>
      </Section>

      <Section title="7. Payment Terms">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="hm-cycle">Payment Cycle / Terms (Days)</Label>
            <Input
              id="hm-cycle"
              type="number"
              min={0}
              value={form.details.paymentTerms?.cycleDays ?? ''}
              onChange={(e) =>
                patchDetails({
                  paymentTerms: {
                    ...form.details.paymentTerms,
                    cycleDays: e.target.value === '' ? null : Number(e.target.value),
                  },
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="hm-duration">Expected Payment Duration (Days)</Label>
            <Input
              id="hm-duration"
              type="number"
              min={0}
              value={form.details.paymentTerms?.expectedDurationDays ?? ''}
              onChange={(e) =>
                patchDetails({
                  paymentTerms: {
                    ...form.details.paymentTerms,
                    expectedDurationDays: e.target.value === '' ? null : Number(e.target.value),
                  },
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="hm-start">Payment Start Date</Label>
            <Input
              id="hm-start"
              type="date"
              value={form.details.paymentTerms?.startDate ?? ''}
              onChange={(e) =>
                patchDetails({
                  paymentTerms: {
                    ...form.details.paymentTerms,
                    startDate: e.target.value,
                  },
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="hm-end">Payment End Date</Label>
            <Input
              id="hm-end"
              type="date"
              value={form.details.paymentTerms?.endDate ?? ''}
              onChange={(e) =>
                patchDetails({
                  paymentTerms: {
                    ...form.details.paymentTerms,
                    endDate: e.target.value,
                  },
                })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Calendar-Based Payment Tracking</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() =>
                patchDetails({
                  paymentTerms: {
                    ...form.details.paymentTerms,
                    trackingEntries: [...tracking, { date: '', note: '' }],
                  },
                })
              }
            >
              <Plus className="size-3.5" />
              Add entry
            </Button>
          </div>
          {tracking.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tracking entries yet.</p>
          ) : (
            <div className="space-y-2">
              {tracking.map((entry, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-2 rounded-md border p-2">
                  <div className="min-w-[140px] flex-1">
                    <Label className="text-xs">Date</Label>
                    <Input
                      type="date"
                      value={entry.date}
                      onChange={(e) => {
                        const next = tracking.map((t, i) =>
                          i === idx ? { ...t, date: e.target.value } : t,
                        )
                        patchDetails({
                          paymentTerms: { ...form.details.paymentTerms, trackingEntries: next },
                        })
                      }}
                    />
                  </div>
                  <div className="min-w-[160px] flex-[2]">
                    <Label className="text-xs">Note</Label>
                    <Input
                      value={entry.note ?? ''}
                      onChange={(e) => {
                        const next = tracking.map((t, i) =>
                          i === idx ? { ...t, note: e.target.value } : t,
                        )
                        patchDetails({
                          paymentTerms: { ...form.details.paymentTerms, trackingEntries: next },
                        })
                      }}
                      placeholder="Optional"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      patchDetails({
                        paymentTerms: {
                          ...form.details.paymentTerms,
                          trackingEntries: tracking.filter((_, i) => i !== idx),
                        },
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="8. Hospital Rating & Remarks">
        <div className="space-y-2">
          <Label>Rating (1–5 Stars)</Label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => {
              const active = (form.details.rating ?? 0) >= n
              return (
                <button
                  key={n}
                  type="button"
                  className="rounded p-0.5"
                  onClick={() =>
                    patchDetails({
                      rating: form.details.rating === n ? null : n,
                    })
                  }
                  aria-label={`${n} star${n === 1 ? '' : 's'}`}
                >
                  <Star
                    className={cn(
                      'size-6',
                      active ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground',
                    )}
                  />
                </button>
              )
            })}
            {form.details.rating != null && (
              <span className="ml-2 text-sm text-muted-foreground">{form.details.rating} / 5</span>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="hm-remarks">Remarks / Feedback</Label>
          <Textarea
            id="hm-remarks"
            value={form.details.remarks ?? ''}
            onChange={(e) => patchDetails({ remarks: e.target.value })}
            rows={3}
          />
        </div>
      </Section>

      <Section title="9. Additional Notes">
        <div>
          <Label htmlFor="hm-special">Special Conditions</Label>
          <Textarea
            id="hm-special"
            value={form.details.specialConditions ?? ''}
            onChange={(e) => patchDetails({ specialConditions: e.target.value })}
            rows={2}
          />
        </div>
        <div>
          <Label htmlFor="hm-agree">Hospital-Specific Agreements</Label>
          <Textarea
            id="hm-agree"
            value={form.details.hospitalAgreements ?? ''}
            onChange={(e) => patchDetails({ hospitalAgreements: e.target.value })}
            rows={2}
          />
        </div>
        <div>
          <Label htmlFor="hm-internal">Internal Comments</Label>
          <Textarea
            id="hm-internal"
            value={form.details.internalComments ?? ''}
            onChange={(e) => patchDetails({ internalComments: e.target.value })}
            rows={2}
          />
        </div>
      </Section>
    </div>
  )
}
