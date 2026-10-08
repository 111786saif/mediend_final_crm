import * as XLSX from 'xlsx'
import { NextResponse } from 'next/server'
import { getSessionWithFreshUser } from '@/lib/session'
import { hasPlOrFinanceRead } from '@/lib/rbac'

const headers = ['Lead Ref','Lead ID','Month','Lead Received (Insurance)','Manager','BDM','Patient','Category','Treatment','Circle','Doctor','Hospital','Admission Date','Surgery Date','Payment Type','P&L Status','Status','Total Bill','Approved Amount','Total Deduction','Deduction Paid by Patient','Waived Off','Amount Paid','MediEND %','MediEND Share','Doctor Fee','Implant','Implant By','Instrument','Instrument By','D&C','Cab','Referral','Actual Implant','Actual Instrument','Hospital Recover','MediEND Net %','MediEND Net','Net Profit','Mediend Profit','Remarks','MediEND Payout','Doctor Payout','Invoice Status','Pt Number']

export async function GET() {
  const user = await getSessionWithFreshUser()
  if (!user || !hasPlOrFinanceRead(user)) return new NextResponse('Forbidden', { status: 403 })
  const sheet = XLSX.utils.aoa_to_sheet([headers, ['LEAD-REF-REQUIRED', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'NEW', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'PENDING', 'PENDING', 'PENDING', '']])
  sheet['!cols'] = headers.map((header) => ({ wch: Math.max(14, header.length + 2) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'P&L Import')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return new NextResponse(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="pl-import-sample.xlsx"' } })
}
