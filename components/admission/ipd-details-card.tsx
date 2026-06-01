import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import { Building2, Calendar, MapPin, Shield, User, Stethoscope, Wallet } from 'lucide-react'
import { getIpdStatusLabel } from '@/lib/ipd-status-labels'

/** Minimal lead shape for displaying form data on the card (optional). */
interface LeadForCard {
  patientName?: string | null
  leadRef?: string | null
  age?: number | null
  sex?: string | null
  phoneNumber?: string | null
  alternateNumber?: string | null
  attendantName?: string | null
  circle?: string | null
  treatment?: string | null
  category?: string | null
  quantityGrade?: string | null
  anesthesia?: string | null
  surgeonName?: string | null
  ipdDrName?: string | null
  surgeonType?: string | null
  hospitalName?: string | null
  insuranceName?: string | null
  flowType?: string | null
  modeOfPayment?: string | null
  discount?: number | null
  copay?: number | null
  deduction?: number | null
  settledTotal?: number | null
  billAmount?: number | null
  collectedByMediend?: number | null
  collectedByHospital?: number | null
  remarks?: string | null
  dischargeSheet?: {
    billAmount?: number | null
    cashOrDedPaid?: number | null
    collectedByHospital?: number | null
    collectedByMediend?: number | null
    deductionAmount?: number | null
    discountAmount?: number | null
    settlementPart?: number | null
  } | null
  bd?: { name?: string | null; manager?: { name?: string | null } | null } | null
  kypSubmission?: {
    insuranceType?: string | null
    preAuthData?: {
      sumInsured?: string | null
      copay?: string | null
      capping?: number | string | null
      roomRent?: string | null
      requestedRoomType?: string | null
      tpa?: string | null
    } | null
  } | null
}

interface IPDDetailsCardProps {
  admissionRecord: any
  lead?: LeadForCard | null
}

function fmtCurr(v: number | string | null | undefined) {
  if (v == null || v === '') return undefined
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return undefined
  return `₹${n.toLocaleString('en-IN')}`
}

function extractLatestAmountFromRemarks(
  remarks: string | null | undefined,
  key: string,
) {
  if (!remarks) return undefined
  const regex = new RegExp(`${key}:\\s*([\\d.]+)`, 'gi')
  const matches = [...remarks.matchAll(regex)]
  if (matches.length === 0) return undefined
  const value = Number(matches[matches.length - 1][1])
  return Number.isFinite(value) ? value : undefined
}

export function IPDDetailsCard({ admissionRecord, lead }: IPDDetailsCardProps) {
  if (!admissionRecord) return null

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      return format(new Date(dateStr), 'dd MMM yyyy')
    } catch (e) {
      return dateStr
    }
  }

  const tpa = admissionRecord.tpa ?? lead?.kypSubmission?.preAuthData?.tpa ?? '-'
  const isCash = lead?.flowType === 'CASH'
  const preAuth = lead?.kypSubmission?.preAuthData
  const discharge = lead?.dischargeSheet
  const approvedAmount = (lead?.settledTotal ?? 0) > 0 ? lead?.settledTotal : discharge?.settlementPart
  const finalBillAmount = (lead?.billAmount ?? 0) > 0 ? lead?.billAmount : discharge?.billAmount
  const collectedAmount = extractLatestAmountFromRemarks(lead?.remarks, 'Collected')
  const collectedByMediend = (lead?.collectedByMediend ?? 0) > 0 ? lead?.collectedByMediend : discharge?.collectedByMediend
  const collectedByHospital = (lead?.collectedByHospital ?? 0) > 0 ? lead?.collectedByHospital : discharge?.collectedByHospital
  const discountAmount = (lead?.discount ?? 0) > 0 ? lead?.discount : discharge?.discountAmount
  const deductionAmount = (lead?.deduction ?? 0) > 0 ? lead?.deduction : discharge?.deductionAmount

  return (
    <Card className="border-2 shadow-sm">
      <CardHeader className="bg-linear-to-r from-teal-50 to-emerald-50 dark:from-teal-950/20 dark:to-emerald-950/20 border-b">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <CardTitle>IPD Admission Details</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Patient Information (from form) */}
          {lead && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300 border-b pb-2">
                <User className="w-4 h-4 text-blue-600" />
                Patient Information
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">Patient Name</Label>
                    <p className="text-sm font-semibold">{lead.patientName ?? '-'}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">Patient ID / Ref</Label>
                    <p className="text-sm font-semibold">{lead.leadRef ?? '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">Age</Label>
                    <p className="text-sm font-semibold">{lead.age != null ? lead.age : '-'}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">Gender</Label>
                    <p className="text-sm font-semibold">{lead.sex ?? '-'}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">Alternate Contact</Label>
                  <p className="text-sm font-semibold">{lead.attendantName || lead.alternateNumber ? `${lead.attendantName ?? '-'} / ${lead.alternateNumber ?? '-'}` : '-'}</p>
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">Circle</Label>
                  <p className="text-sm font-semibold">{lead.circle ?? '-'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Treatment & Procedure (from form) */}
          {lead && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300 border-b pb-2">
                <Stethoscope className="w-4 h-4 text-purple-600" />
                Treatment & Procedure
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">Treatment</Label>
                  <p className="text-sm font-semibold">{lead.treatment ?? '-'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">Quantity / Grade</Label>
                    <p className="text-sm font-semibold">{lead.quantityGrade ?? '-'}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">Anaesthesia</Label>
                    <p className="text-sm font-semibold">{lead.anesthesia ?? '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Surgeon (from form) */}
          {lead && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300 border-b pb-2">
                <User className="w-4 h-4 text-teal-600" />
                Surgeon Details
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">Surgeon Name</Label>
                  <p className="text-sm font-semibold">{lead.ipdDrName ?? lead.surgeonName ?? '-'}</p>
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">Surgeon Type</Label>
                  <p className="text-sm font-semibold">{lead.surgeonType ?? '-'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Admission & Surgery */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300 border-b pb-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Admission & Surgery
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {admissionRecord.ipdStatus && (
                <div className="pb-2 border-b border-gray-200 dark:border-gray-700">
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">IPD Status</Label>
                  <p className="text-sm font-bold text-purple-600 dark:text-purple-400">{getIpdStatusLabel(admissionRecord.ipdStatus)}</p>
                  {admissionRecord.ipdStatusUpdatedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">Updated {format(new Date(admissionRecord.ipdStatusUpdatedAt), 'dd MMM yyyy, HH:mm')}</p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">Admission Date</Label>
                  <p className="text-sm font-semibold">{formatDate(admissionRecord.admissionDate)}</p>
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">Time</Label>
                  <p className="text-sm font-semibold">{admissionRecord.admissionTime || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">
                    {admissionRecord.ipdStatus === 'POSTPONED' && admissionRecord.newSurgeryDate ? 'Original surgery date' : 'Surgery Date'}
                  </Label>
                  <p className="text-sm font-semibold">{formatDate(admissionRecord.surgeryDate)}</p>
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">Time</Label>
                  <p className="text-sm font-semibold">{admissionRecord.surgeryTime || '-'}</p>
                </div>
              </div>
              {admissionRecord.ipdStatus === 'POSTPONED' && admissionRecord.newSurgeryDate && (
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">New surgery date</Label>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatDate(admissionRecord.newSurgeryDate)}</p>
                </div>
              )}
              {admissionRecord.ipdStatus === 'DISCHARGED' && admissionRecord.ipdDischargeDate && (
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">Discharge date</Label>
                  <p className="text-sm font-semibold">{formatDate(admissionRecord.ipdDischargeDate)}</p>
                </div>
              )}
              {admissionRecord.ipdStatusReason && (
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">Reason</Label>
                  <p className="text-sm text-muted-foreground">{admissionRecord.ipdStatusReason}</p>
                </div>
              )}
              {admissionRecord.ipdStatusNotes && (
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">Status notes</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{admissionRecord.ipdStatusNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Hospital Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300 border-b pb-2">
              <Building2 className="w-4 h-4 text-amber-600" />
              Hospital Details
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label className="text-[10px] uppercase text-gray-500 font-bold">Admitting Hospital</Label>
                <p className="text-sm font-semibold">{admissionRecord.admittingHospital || lead?.hospitalName || '-'}</p>
              </div>
              <div>
                <Label className="text-[10px] uppercase text-gray-500 font-bold">Address</Label>
                <p className="text-sm font-semibold line-clamp-2" title={admissionRecord.hospitalAddress}>{admissionRecord.hospitalAddress || '-'}</p>
              </div>
              {admissionRecord.googleMapLocation && (
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">Location</Label>
                  <div className="mt-1">
                    <a 
                      href={admissionRecord.googleMapLocation} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3" /> View on Maps
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Insurance & Billing (insurance flow) */}
          {lead && !isCash && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300 border-b pb-2">
                <Shield className="w-4 h-4 text-green-600" />
                Insurance & Billing
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">Insurance Type</Label>
                    <p className="text-sm font-semibold">{lead.kypSubmission?.insuranceType != null ? String(lead.kypSubmission.insuranceType).replace(/_/g, ' ') : '-'}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">Insurance Company</Label>
                    <p className="text-sm font-semibold">{lead.insuranceName ?? '-'}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">TPA</Label>
                  <p className="text-sm font-semibold">{tpa}</p>
                </div>
                {(preAuth?.sumInsured != null || preAuth?.copay != null || preAuth?.requestedRoomType != null || preAuth?.capping != null || preAuth?.roomRent != null) && (
                  <div className="grid grid-cols-2 gap-3">
                    {preAuth?.sumInsured != null && (
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Sum Insured</Label>
                        <p className="text-sm font-semibold">{typeof preAuth.sumInsured === 'string' ? preAuth.sumInsured : fmtCurr(preAuth.sumInsured) ?? '-'}</p>
                      </div>
                    )}
                    {preAuth?.copay != null && (
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Co-pay</Label>
                        <p className="text-sm font-semibold">{preAuth.copay}%</p>
                      </div>
                    )}
                    {preAuth?.requestedRoomType != null && (
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Room Type</Label>
                        <p className="text-sm font-semibold">{preAuth.requestedRoomType}</p>
                      </div>
                    )}
                    {preAuth?.capping != null && preAuth.capping !== '' && (
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Capping</Label>
                        <p className="text-sm font-semibold">
                          {typeof preAuth.capping === 'string' && !Number.isNaN(Number(preAuth.capping))
                            ? (fmtCurr(Number(preAuth.capping)) ?? '-')
                            : preAuth.capping}
                        </p>
                      </div>
                    )}
                    {preAuth?.roomRent != null && (
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Room Rent</Label>
                        <p className="text-sm font-semibold">{typeof preAuth.roomRent === 'string' ? preAuth.roomRent : fmtCurr(preAuth.roomRent) ?? '-'}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment & Billing (cash flow) */}
          {lead && isCash && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300 border-b pb-2">
                <Wallet className="w-4 h-4 text-green-600" />
                Payment & Billing
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {lead.modeOfPayment && (
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">Mode of Payment</Label>
                    <p className="text-sm font-semibold">{lead.modeOfPayment}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                    {(approvedAmount != null && approvedAmount > 0) && (
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Approved / Package</Label>
                        <p className="text-sm font-semibold">{fmtCurr(approvedAmount)}</p>
                      </div>
                    )}
                    {(finalBillAmount != null && finalBillAmount > 0) && (
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Final Bill Amount</Label>
                        <p className="text-sm font-semibold">{fmtCurr(finalBillAmount)}</p>
                      </div>
                    )}
                  </div>
                  {(collectedAmount != null && collectedAmount > 0) && (
                    <div>
                      <Label className="text-[10px] uppercase text-gray-500 font-bold">Cash / Deduction Collected</Label>
                      <p className="text-sm font-semibold">{fmtCurr(collectedAmount)}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {(collectedByMediend != null && collectedByMediend > 0) && (
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Collected by Mediend</Label>
                        <p className="text-sm font-semibold">{fmtCurr(collectedByMediend)}</p>
                      </div>
                    )}
                    {(collectedByHospital != null && collectedByHospital > 0) && (
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Collected by Hospital</Label>
                        <p className="text-sm font-semibold">{fmtCurr(collectedByHospital)}</p>
                      </div>
                    )}
                  </div>
                {(discountAmount != null && discountAmount > 0) && (
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">Discount</Label>
                    <p className="text-sm font-semibold">{fmtCurr(discountAmount)}</p>
                  </div>
                )}
                {(lead.copay != null && lead.copay > 0) && (
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">Copay</Label>
                    <p className="text-sm font-semibold">{fmtCurr(lead.copay)}</p>
                  </div>
                )}
                {(deductionAmount != null && deductionAmount > 0) && (
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">Deduction</Label>
                    <p className="text-sm font-semibold">{fmtCurr(deductionAmount)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Medical & Insurance (TPA when cash or no insurance section) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300 border-b pb-2">
              <Shield className="w-4 h-4 text-green-600" />
              Medical & Implants
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {(isCash || !lead) && (
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">TPA</Label>
                  <p className="text-sm font-semibold">{tpa}</p>
                </div>
              )}
              {(admissionRecord.implantConsumables || admissionRecord.instrument) && (
                <div className="space-y-2">
                   {admissionRecord.implantConsumables && (
                     <div>
                       <Label className="text-[10px] uppercase text-gray-500 font-bold">Implants/Consumables</Label>
                       <p className="text-sm whitespace-pre-line">{admissionRecord.implantConsumables}</p>
                     </div>
                   )}
                   {admissionRecord.instrument && (
                     <div>
                       <Label className="text-[10px] uppercase text-gray-500 font-bold">Instruments</Label>
                       <p className="text-sm whitespace-pre-line">{admissionRecord.instrument}</p>
                     </div>
                   )}
                </div>
              )}
              {admissionRecord.notes && (
                <div>
                  <Label className="text-[10px] uppercase text-gray-500 font-bold">Notes</Label>
                  <p className="text-sm italic text-muted-foreground">{admissionRecord.notes}</p>
                </div>
              )}
              {lead?.bd && (lead.bd.name || lead.bd.manager?.name) && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">BD Name</Label>
                    <p className="text-sm font-semibold">{lead.bd.name ?? '-'}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">BD Manager</Label>
                    <p className="text-sm font-semibold">{lead.bd.manager?.name ?? '-'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
