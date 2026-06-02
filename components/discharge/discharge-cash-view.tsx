'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, ExternalLink, User, Building2, Calendar, Receipt, Pencil } from 'lucide-react'
import Link from 'next/link'

interface DischargeCashViewProps {
  data: any
  onEdit?: () => void
}

function Section({ title, icon, color, children }: { title: string; icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <Card className={`border-l-4 ${color} mb-6`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {icon}{title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

function InfoRow({ label, value, isCurrency = false }: { label: string; value?: string | number | null; isCurrency?: boolean }) {
  const displayValue = value != null 
    ? (isCurrency ? `₹ ${Number(value).toLocaleString('en-IN')}` : value) 
    : '—'
    
  return (
    <div className="flex justify-between py-1 border-b border-dashed last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{displayValue}</span>
    </div>
  )
}

function DocLink({ url, name }: { url?: string; name: string }) {
  if (!url) return null
  return (
    <Button variant="outline" size="sm" asChild className="w-full justify-start">
      <Link href={url} target="_blank">
        <FileText className="mr-2 h-4 w-4" />
        <span className="truncate flex-1 text-left">{name}</span>
        <ExternalLink className="ml-2 h-3 w-3 opacity-50" />
      </Link>
    </Button>
  )
}

export function DischargeCashView({ data, onEdit }: DischargeCashViewProps) {
  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Discharge Sheet (Cash Flow)</h2>
        <div className="flex items-center gap-3">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Edit Sheet
            </Button>
          )}
          <div className="text-sm text-muted-foreground">
            Created on {new Date(data.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Section A: Patient & Discharge Info */}
      <Section
        title="A. Patient & Discharge Info"
        icon={<User className="h-4 w-4 text-blue-600" />}
        color="border-blue-500"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <InfoRow label="Patient Name" value={data.patientName} />
          <InfoRow label="Hospital" value={data.hospitalName} />
          <InfoRow label="Discharge Date" value={data.dischargeDate ? new Date(data.dischargeDate).toLocaleDateString() : null} />
          <InfoRow label="Final Amount" value={data.finalAmount} isCurrency />
        </div>
      </Section>

      {/* Section B: Documents */}
      <Section
        title="B. Documents"
        icon={<FileText className="h-4 w-4 text-purple-600" />}
        color="border-purple-500"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DocLink url={data.finalBillUrl} name="Final Bill" />
          <DocLink url={data.settlementLetterUrl} name="Settlement Letter" />
        </div>
      </Section>

      {/* Section C: Bill Breakup */}
      <Section
        title="C. Bill Breakup"
        icon={<Receipt className="h-4 w-4 text-orange-600" />}
        color="border-orange-500"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
          <InfoRow label="Room Rent" value={data.roomRentAmount} isCurrency />
          <InfoRow label="Pharmacy" value={data.pharmacyAmount} isCurrency />
          <InfoRow label="Investigation" value={data.investigationAmount} isCurrency />
          <InfoRow label="Consumables" value={data.consumablesAmount} isCurrency />
          <InfoRow label="Implants" value={data.implantsAmount} isCurrency />
          <InfoRow label="Instruments" value={data.instrumentsAmount} isCurrency />
          {data.otherCharges && <InfoRow label="Other Charges" value={data.otherCharges} />}
          {data.packageAmount && <InfoRow label="Package Amount" value={data.packageAmount} />}
          {data.staplerCharges && (
            <InfoRow
              label="Stapler Charges"
              value={data.staplerCharges === 'INCLUDED' ? 'Included' : 'Open'}
            />
          )}

          <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t flex justify-between items-center bg-muted/30 p-2 rounded">
            <span className="font-semibold">Total Final Bill</span>
            <span className="font-bold text-lg">₹ {Number(data.totalFinalBill || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </Section>

      {/* Remarks */}
      {data.remarks && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{data.remarks}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
