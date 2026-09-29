import * as XLSX from 'xlsx'
import { NextResponse } from 'next/server'
import { getSessionWithFreshUser } from '@/lib/session'
import { hasPlOrFinanceRead } from '@/lib/rbac'

const headers = ['Lead ref','Month','Lead Received (Insurance)','Manager','BDM','Patient','Category','Treatment','Doctor','Hospital','Admission','Surgery','Payment','P&L Status','Status','Total bill','Approved amount','Total Deduction','Deduction Paid by Patient','Waived Off','Amount paid','MediEND %','MediEND share','Doctor fee','Implant','Implant by','Instrument','Instr. by','Actual Implant','Actual Instrument','Hospital Recover','D&C','Cab','Referral','MediEND Net %','MediEND Net','Net profit','Remarks','MediEND payout','Dr payout','Invoice']

export async function GET() {
  const user = await getSessionWithFreshUser()
  if (!user || !hasPlOrFinanceRead(user)) return new NextResponse('Forbidden', { status: 403 })
  const sheet = XLSX.utils.aoa_to_sheet([headers, ['LEAD-REF-REQUIRED', '', '', '', '', '', '', '', '', '', '', '', '', 'NEW', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'PENDING', 'PENDING', 'PENDING']])
  sheet['!cols'] = headers.map((header) => ({ wch: Math.max(14, header.length + 2) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'P&L Import')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return new NextResponse(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="pl-import-sample.xlsx"' } })
}
