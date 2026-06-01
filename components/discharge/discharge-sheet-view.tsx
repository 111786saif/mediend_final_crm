'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { apiPost } from '@/lib/api-client'
import { toast } from 'sonner'
import { useState } from 'react'
import { format } from 'date-fns'
import { ExternalLink, Pencil } from 'lucide-react'

interface DischargeSheetViewProps {
  dischargeSheet: {
    id: string
    dischargeDate?: string | null
    surgeryDate?: string | null
    status?: string | null
    hospitalName?: string | null
    doctorName?: string | null
    tentativeAmount?: number | null
    finalAmount?: number | null
    copayPct?: number | null
    dischargeSummaryUrl?: string | null
    otNotesUrl?: string | null
    codesCount?: number | null
    finalBillUrl?: string | null
    finalApprovedUrl?: string | null
    deductionReceiptUrl?: string | null
    settlementLetterUrl?: string | null
    roomRentAmount?: number
    pharmacyAmount?: number
    investigationAmount?: number
    consumablesAmount?: number
    implantsAmount?: number
    instrumentsAmount?: number | null
    anesthesiaAmount?: number
    otherChargesAmount?: number
    otherCharges?: string | null
    packageAmount?: string | null
    staplerCharges?: string | null
    totalFinalBill?: number
    finalApprovedAmount?: number
    copayAmount?: number
    collectedByHospital?: number
    collectedByMediend?: number
    axisTariffDeduction?: number
    axisTariffDeductionPaid?: number
    actualFinalAmount?: number
    deductionAmount?: number
    discountAmount?: number
    waivedOffAmount?: number
    settlementPart?: number
    tdsAmount?: number
    otherDeduction?: number
    netSettlementAmount?: number
    remarks?: string | null
    plRecord?: { id: string } | null
    lead?: {
      surgeonName?: string | null
      ipdDrName?: string | null
      copay?: number | null
      kypSubmission?: {
        preAuthData?: { sumInsured?: string | null; roomRent?: string | null; copay?: string | null } | null
      } | null
    } | null
    [key: string]: unknown
  }
  onEdit?: () => void
}

function DocCell({ label, url }: { label: string; url?: string | null }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm">{label}</span>
      {url ? (
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => window.open(url, '_blank')}>
          View <ExternalLink className="ml-1 h-3 w-3" />
        </Button>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      )}
    </div>
  )
}

const rupee = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`

function AmountRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-3 border-b border-border last:border-0">
      <span className="text-sm">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-green-600' : ''}`}>{rupee(value)}</span>
    </div>
  )
}

export function DischargeSheetView({ dischargeSheet, onEdit }: DischargeSheetViewProps) {
  const [creatingPNL, setCreatingPNL] = useState(false)

  const handleCreatePNL = async () => {
    if (!confirm('Create PNL record from this discharge sheet?')) return
    setCreatingPNL(true)
    try {
      await apiPost(`/api/discharge-sheet/${dischargeSheet.id}/create-pnl`, {})
      toast.success('PNL record created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create PNL record')
    } finally {
      setCreatingPNL(false)
    }
  }

  const billHeads: { label: string; value: number }[] = [
    { label: 'Room Rent', value: dischargeSheet.roomRentAmount ?? 0 },
    { label: 'Pharmacy', value: dischargeSheet.pharmacyAmount ?? 0 },
    { label: 'Investigation', value: dischargeSheet.investigationAmount ?? 0 },
    { label: 'Consumables', value: dischargeSheet.consumablesAmount ?? 0 },
    { label: 'Implants', value: dischargeSheet.implantsAmount ?? 0 },
    ...(dischargeSheet.instrumentsAmount != null && dischargeSheet.instrumentsAmount > 0
      ? [{ label: 'Instruments', value: dischargeSheet.instrumentsAmount }]
      : []),
    ...(dischargeSheet.anesthesiaAmount != null && dischargeSheet.anesthesiaAmount > 0
      ? [{ label: 'Anesthesia', value: dischargeSheet.anesthesiaAmount }]
      : []),
  ]

  // Other Charges: prefer the computed numeric, fall back to legacy free-text.
  const otherChargesDisplay =
    dischargeSheet.otherChargesAmount != null
      ? rupee(dischargeSheet.otherChargesAmount)
      : dischargeSheet.otherCharges ?? null

  const preAuth = dischargeSheet.lead?.kypSubmission?.preAuthData
  const sumInsured = preAuth?.sumInsured ?? null
  const leadRef = dischargeSheet.lead as { surgeonName?: string | null; ipdDrName?: string | null; copay?: number | null } | undefined
  const doctorDisplay =
    dischargeSheet.doctorName ||
    leadRef?.surgeonName ||
    leadRef?.ipdDrName ||
    '—'
  const leadCopay = leadRef?.copay
  const preAuthCopayStr = (preAuth as { copay?: string | null } | undefined)?.copay
  const preAuthCopayNum =
    preAuthCopayStr != null && preAuthCopayStr !== '' ? parseFloat(String(preAuthCopayStr)) : null
  const copayValue =
    dischargeSheet.copayPct ??
    (leadCopay != null && leadCopay !== 0 ? leadCopay : null) ??
    (preAuthCopayNum != null && !Number.isNaN(preAuthCopayNum) ? preAuthCopayNum : null)

  // Deduction roll-ups (recompute for robustness; old rows have 0 defaults).
  const copay = dischargeSheet.copayAmount ?? 0
  const otherDed = dischargeSheet.otherDeduction ?? 0
  const deductionTotal = copay + otherDed
  const collectedHospital = dischargeSheet.collectedByHospital ?? 0
  const collectedMediend = dischargeSheet.collectedByMediend ?? 0
  const deductionPaidTotal = collectedHospital + collectedMediend
  const axisDed = dischargeSheet.axisTariffDeduction ?? 0
  const axisDedPaid = dischargeSheet.axisTariffDeductionPaid ?? 0
  const finalApproved = dischargeSheet.finalApprovedAmount ?? 0
  const actualFinal =
    dischargeSheet.actualFinalAmount && dischargeSheet.actualFinalAmount > 0
      ? dischargeSheet.actualFinalAmount
      : dischargeSheet.netSettlementAmount && dischargeSheet.netSettlementAmount > 0
      ? dischargeSheet.netSettlementAmount
      : finalApproved + deductionPaidTotal + axisDedPaid

  return (
    <div className="space-y-6">
      {/* A. Patient & Policy Details */}
      <Card>
        <CardHeader>
          <CardTitle>A. Patient & Policy Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-muted-foreground">Sum Insured</Label>
            <p className="text-sm font-medium mt-1">{sumInsured ?? '—'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Hospital Name</Label>
            <p className="text-sm font-medium mt-1">{dischargeSheet.hospitalName || '—'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Copay %</Label>
            <p className="text-sm font-medium mt-1">{copayValue != null ? `${Number(copayValue)}%` : '—'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Doctor Name</Label>
            <p className="text-sm font-medium mt-1">{doctorDisplay}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Final Bill Amount</Label>
            <p className="text-sm font-medium mt-1">
              {dischargeSheet.finalAmount != null ? rupee(dischargeSheet.finalAmount) : dischargeSheet.tentativeAmount != null ? rupee(dischargeSheet.tentativeAmount) : '—'}
            </p>
          </div>
          {dischargeSheet.dischargeDate && (
            <div>
              <Label className="text-muted-foreground">Discharge Date</Label>
              <p className="text-sm font-medium mt-1">{format(new Date(dischargeSheet.dischargeDate), 'PP')}</p>
            </div>
          )}
          {dischargeSheet.surgeryDate && (
            <div>
              <Label className="text-muted-foreground">Surgery Date</Label>
              <p className="text-sm font-medium mt-1">{format(new Date(dischargeSheet.surgeryDate), 'PP')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* B. Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle>B. Documents Section</CardTitle>
          <CardDescription>Discharge Summary, OT Notes, Codes Count</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <DocCell label="Discharge Summary" url={dischargeSheet.dischargeSummaryUrl} />
          <DocCell label="OT Notes" url={dischargeSheet.otNotesUrl} />
          <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <span className="text-sm">Codes Count</span>
            <span className="text-sm font-medium">{dischargeSheet.codesCount ?? '—'}</span>
          </div>
        </CardContent>
      </Card>

      {/* C. Bill Breakup Table */}
      <Card>
        <CardHeader>
          <CardTitle>C. Bill Breakup Table</CardTitle>
          <CardDescription>Head | Amount</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 font-medium text-sm border-b">
            <span>Head</span>
            <span>Amount</span>
          </div>
          {billHeads.map(({ label, value }) => (
            <AmountRow key={label} label={label} value={value} />
          ))}
          {otherChargesDisplay && (
            <div className="grid grid-cols-2 gap-2 p-3 border-b border-border last:border-0">
              <span className="text-sm">Other Charges</span>
              <span className="text-sm font-medium">{otherChargesDisplay}</span>
            </div>
          )}
          {dischargeSheet.packageAmount && (
            <div className="grid grid-cols-2 gap-2 p-3 border-b border-border last:border-0">
              <span className="text-sm">Package Amount <span className="text-muted-foreground">(excluded from total)</span></span>
              <span className="text-sm font-medium">{dischargeSheet.packageAmount}</span>
            </div>
          )}
          {dischargeSheet.staplerCharges && (
            <div className="grid grid-cols-2 gap-2 p-3 border-b border-border last:border-0">
              <span className="text-sm">Stapler Charges</span>
              <span className="text-sm font-medium">
                {dischargeSheet.staplerCharges === 'INCLUDED' ? 'Included' : 'Open'}
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 p-3 border-t bg-muted/30">
            <span className="text-sm font-semibold">Total Final Bill</span>
            <span className="text-sm font-semibold">{rupee(dischargeSheet.totalFinalBill ?? 0)}</span>
          </div>
        </CardContent>
      </Card>

      {/* D. Approval & Deductions */}
      <Card>
        <CardHeader>
          <CardTitle>D. Approval & Deductions</CardTitle>
          <CardDescription>Item | Amount</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Final Approved */}
          <AmountRow label="Final Approved Amount" value={finalApproved} />
          <DocCell label="Approval Letter" url={dischargeSheet.finalApprovedUrl} />

          {/* Deductions */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 font-medium text-sm border-y">
            <span>Deductions</span>
            <span />
          </div>
          <AmountRow label="Copay" value={copay} />
          <AmountRow label="Other Deductions" value={otherDed} />
          <AmountRow label="Total Deductions" value={deductionTotal} />

          {/* Deductions Paid */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 font-medium text-sm border-y">
            <span>Deductions Paid</span>
            <span />
          </div>
          <AmountRow label="Collected by Hospital" value={collectedHospital} />
          <AmountRow label="Collected by Mediend" value={collectedMediend} />
          <AmountRow label="Total Paid" value={deductionPaidTotal} />
          <DocCell label="Receipt" url={dischargeSheet.deductionReceiptUrl} />

          {/* Hospital Discount & Waive Off */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 font-medium text-sm border-y">
            <span>Hospital Discount &amp; Waive Off</span>
            <span />
          </div>
          <AmountRow label="Hospital Discount" value={dischargeSheet.discountAmount ?? 0} />
          <AmountRow label="Waive Off" value={dischargeSheet.waivedOffAmount ?? 0} />

          {/* Exxis Tarrif */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 font-medium text-sm border-y">
            <span>Exxis Tarrif</span>
            <span />
          </div>
          <AmountRow label="Deduction" value={axisDed} />
          <AmountRow label="Deduction Paid" value={axisDedPaid} />

          {/* Actual Final Amount */}
          <div className="grid grid-cols-2 gap-2 p-3 border-t bg-green-50 dark:bg-green-950">
            <span className="text-sm font-semibold">Actual Final Amount</span>
            <span className="text-sm font-semibold text-green-700 dark:text-green-400">{rupee(actualFinal)}</span>
          </div>

          {/* Final Bill */}
          <DocCell label="Final Bill" url={dischargeSheet.finalBillUrl} />
        </CardContent>
      </Card>

      {dischargeSheet.remarks && (
        <Card>
          <CardHeader>
            <CardTitle>Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{dischargeSheet.remarks}</p>
          </CardContent>
        </Card>
      )}

      {(onEdit || !dischargeSheet.plRecord) && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Manage this discharge sheet</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            {onEdit && (
              <Button variant="outline" onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" /> Edit Sheet
              </Button>
            )}
            {!dischargeSheet.plRecord && (
              <Button onClick={handleCreatePNL} disabled={creatingPNL}>
                {creatingPNL ? 'Creating...' : 'Create PNL Record'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
