import * as XLSX from 'xlsx'
import { NextResponse } from 'next/server'
import { getSessionWithFreshUser } from '@/lib/session'
import { hasPlOrFinanceRead } from '@/lib/rbac'

const headers = ['Month','Lead Date','ATL/TL/ACM/CM/SCM','BDM','Appointment ID','P. Number','P. Name','Category','Treatment','Circle','Doctors','Hospitals','Arrival Date','Surgery Date','Week','Payment','Status','Approved/Cash','Cash/Ded. Paid','Total','Bill Amount','Total deduction','Wavied off','Payment Collected At','Type','Insurance Company','TPA','Final Approval','Lead Source','Hospital Share %','Hospital Share','Doctor Charges','Doctor Payment Status','Instuments Charges','Instuments Payment Status','D&C','Implant Cost','EMI Suvention %','EMI Subvention Charges','Cab Charges','Cab Status','Refferal %','Referral Amount','Referral Status','Referral','MediEND Share %','MediEND Share','MediEND Payment Status','MediEND Net-Profit']

export async function GET() {
  const user = await getSessionWithFreshUser()
  if (!user || !hasPlOrFinanceRead(user)) return new NextResponse('Forbidden', { status: 403 })
  const sheet = XLSX.utils.aoa_to_sheet([headers, ['', '', '', '', 'LEAD-REF-REQUIRED', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']])
  sheet['!cols'] = headers.map((header) => ({ wch: Math.max(14, header.length + 2) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'P&L Import')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return new NextResponse(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="pl-import-sample.xlsx"' } })
}
