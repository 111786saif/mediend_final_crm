import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, ExternalLink, Shield, Building2, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Section } from '@/components/patient/details-section'

interface InitiateFormCardProps {
  initiateForm: any
}

function fmtCurr(v: number | string | null | undefined) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return null
  return `₹${n.toLocaleString('en-IN')}`
}

export function InitiateFormCard({ initiateForm }: InitiateFormCardProps) {
  if (!initiateForm) return null

  const hasFinancial = !!(
    (initiateForm.totalBillAmount ?? 0) > 0 ||
    (initiateForm.discount ?? 0) > 0 ||
    (initiateForm.otherReductions ?? 0) > 0 ||
    (initiateForm.deductible ?? 0) > 0 ||
    (initiateForm.copay ?? 0) > 0 ||
    (initiateForm.copayBuffer ?? 0) > 0
  )
  const hasAuthPolicy = !!(
    (initiateForm.totalAuthorizedAmount ?? 0) > 0 ||
    (initiateForm.amountToBePaidByInsurance ?? 0) > 0 ||
    (initiateForm.policyDeductibleAmount ?? 0) > 0 ||
    initiateForm.exceedsPolicyLimit
  )
  const hasAdditionalInfo = !!(
    initiateForm.roomCategory ||
    initiateForm.initialApprovalByHospitalUrl ||
    initiateForm.createdBy
  )

  return (
    <Card className="border-2 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border-b">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <CardTitle>Insurance Initiate Form</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <Section icon={Receipt} iconClassName="text-green-600" title="Financial Details" hasContent={hasFinancial}>
          <Field label="Total Bill" value={fmtCurr(initiateForm.totalBillAmount)} truncate />
          <Field label="Discount" value={fmtCurr(initiateForm.discount)} truncate />
          <Field label="Other Reductions" value={fmtCurr(initiateForm.otherReductions)} truncate />
          <Field label="Deductible" value={fmtCurr(initiateForm.deductible)} truncate />
          <Field label="Co-pay" value={initiateForm.copay ? `${initiateForm.copay}%` : null} truncate />
          <Field label="Co-pay Buffer" value={fmtCurr(initiateForm.copayBuffer)} truncate />
        </Section>

        <Section icon={Shield} iconClassName="text-blue-600" title="Authorization & Policy" hasContent={hasAuthPolicy}>
          <Field
            label="Total Authorized"
            value={
              fmtCurr(initiateForm.totalAuthorizedAmount) && (
                <span className="text-green-600 dark:text-green-400">{fmtCurr(initiateForm.totalAuthorizedAmount)}</span>
              )
            }
            truncate
          />
          <Field
            label="To Be Paid By Insurance"
            value={
              fmtCurr(initiateForm.amountToBePaidByInsurance) && (
                <span className="text-blue-600 dark:text-blue-400">{fmtCurr(initiateForm.amountToBePaidByInsurance)}</span>
              )
            }
            truncate
          />
          <Field label="Policy Deductible" value={fmtCurr(initiateForm.policyDeductibleAmount)} truncate />
          <Field label="Exceeds Limit" value={initiateForm.exceedsPolicyLimit} truncate />
        </Section>

        <Section icon={Building2} iconClassName="text-amber-600" title="Additional Info" hasContent={hasAdditionalInfo}>
          <Field label="Room Category" value={initiateForm.roomCategory} />
          {initiateForm.initialApprovalByHospitalUrl && (
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Initial Approval Letter</p>
              <div className="mt-1">
                <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <a href={initiateForm.initialApprovalByHospitalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3" /> View Document
                  </a>
                </Button>
              </div>
            </div>
          )}
          {initiateForm.createdBy && (
            <div className="col-span-2 sm:col-span-3 md:col-span-4 text-xs text-muted-foreground pt-2 border-t">
              Created by {initiateForm.createdBy.name}
            </div>
          )}
        </Section>
      </CardContent>
    </Card>
  )
}