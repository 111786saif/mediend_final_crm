'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { apiPost } from '@/lib/api-client'
import { toast } from 'sonner'
import { useState } from 'react'
import { format } from 'date-fns'
import { ExternalLink } from 'lucide-react'

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
    settlementLetterUrl?: string | null
    roomRentAmount?: number
    pharmacyAmount?: number
    investigationAmount?: number
    consumablesAmount?: number
    implantsAmount?: number
    instrumentsAmount?: number | null
    otherCharges?: string | null
    packageAmount?: string | null
    staplerCharges?: string | null
    totalFinalBill?: number
    finalApprovedAmount?: number
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

export function DischargeSheetView({ dischargeSheet }: DischargeSheetViewProps) {
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
    { label: 'Total Final Bill', value: dischargeSheet.totalFinalBill ?? 0 },
  ]

  const preAuth = dischargeSheet.lead?.kypSubmission?.preAuthData
  const sumInsured = preAuth?.sumInsured ?? null
  const roomRentCap = preAuth?.roomRent ?? null
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

  const approvalItems = [
    { label: 'Final Approved Amount', value: dischargeSheet.finalApprovedAmount ?? 0 },
    { label: 'Deduction Amount', value: dischargeSheet.deductionAmount ?? 0 },
    { label: 'Discount', value: dischargeSheet.discountAmount ?? 0 },
    { label: 'Waived Off Amount', value: dischargeSheet.waivedOffAmount ?? 0 },
    { label: 'Other Deduction', value: dischargeSheet.otherDeduction ?? 0 },
    { label: 'Net Amount', value: dischargeSheet.netSettlementAmount ?? 0 },
  ]

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
            <Label className="text-muted-foreground">Final Amount</Label>
            <p className="text-sm font-medium mt-1">
              {dischargeSheet.finalAmount != null ? `₹${Number(dischargeSheet.finalAmount).toLocaleString()}` : dischargeSheet.tentativeAmount != null ? `₹${Number(dischargeSheet.tentativeAmount).toLocaleString()}` : '—'}
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
          <CardDescription>Discharge Summary, OT Notes, Codes Count, Final Bill, Settlement Letter</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <DocCell label="Discharge Summary" url={dischargeSheet.dischargeSummaryUrl} />
          <DocCell label="OT Notes" url={dischargeSheet.otNotesUrl} />
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm">Codes Count</span>
            <span className="text-sm font-medium">{dischargeSheet.codesCount ?? '—'}</span>
          </div>
          <DocCell label="Final Bill" url={dischargeSheet.finalBillUrl} />
          <DocCell label="Settlement Letter" url={dischargeSheet.settlementLetterUrl} />
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
            <div key={label} className="grid grid-cols-2 gap-2 p-3 border-b border-border last:border-0">
              <span className="text-sm">{label}</span>
              <span className="text-sm font-medium">₹{Number(value).toLocaleString()}</span>
            </div>
          ))}
          {dischargeSheet.otherCharges && (
            <div className="grid grid-cols-2 gap-2 p-3 border-b border-border last:border-0">
              <span className="text-sm">Other Charges</span>
              <span className="text-sm font-medium">{dischargeSheet.otherCharges}</span>
            </div>
          )}
          {dischargeSheet.packageAmount && (
            <div className="grid grid-cols-2 gap-2 p-3 border-b border-border last:border-0">
              <span className="text-sm">Package Amount</span>
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
        </CardContent>
      </Card>

      {/* D. Approval & Deductions Table */}
      <Card>
        <CardHeader>
          <CardTitle>D. Approval & Deductions Table</CardTitle>
          <CardDescription>Item | Amount</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 font-medium text-sm border-b">
            <span>Item</span>
            <span>Amount</span>
          </div>
          {approvalItems.map(({ label, value }) => (
            <div key={label} className="grid grid-cols-2 gap-2 p-3 border-b border-border last:border-0">
              <span className="text-sm">{label}</span>
              <span className={`text-sm font-medium ${label === 'Net Amount' ? 'text-green-600' : ''}`}>
                ₹{Number(value).toLocaleString()}
              </span>
            </div>
          ))}
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

      {!dischargeSheet.plRecord && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Create PNL record from this discharge sheet</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleCreatePNL} disabled={creatingPNL}>
              {creatingPNL ? 'Creating...' : 'Create PNL Record'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
