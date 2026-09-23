import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'
import { hasPlOrFinanceWrite } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

type ImportRow = Record<string, unknown>
const text = (row: ImportRow, key: string) => { const value = row[key]; return value == null || String(value).trim() === '' ? undefined : String(value).trim() }
const number = (row: ImportRow, key: string) => { const value = row[key]; if (value == null || value === '') return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined }
const date = (row: ImportRow, key: string) => { const value = row[key]; if (!value) return undefined; const parsed = new Date(value as string); return Number.isNaN(parsed.getTime()) ? undefined : parsed }
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()
    if (!hasPlOrFinanceWrite(user)) return errorResponse('Forbidden', 403)
    const body = await request.json() as { rows?: ImportRow[] }
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : []
    if (!rows.length) return errorResponse('No import rows supplied', 400)
    const result = { imported: 0, unmatched: [] as string[], invalid: [] as string[] }
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const leadRef = text(row, 'Appointment ID')
      if (!leadRef) { result.invalid.push(`Row ${index + 2}: Appointment ID is required`); continue }
      const lead = await prisma.lead.findUnique({ where: { leadRef }, select: { id: true } })
      if (!lead) { result.unmatched.push(leadRef); continue }
      const plData: Record<string, unknown> = {
        month: date(row, 'Month'), admissionDate: date(row, 'Arrival Date'), surgeryDate: date(row, 'Surgery Date'),
        managerName: text(row, 'ATL/TL/ACM/CM/SCM'), bdmName: text(row, 'BDM'), patientName: text(row, 'P. Name'), patientPhone: text(row, 'P. Number'),
        category: text(row, 'Category'), treatment: text(row, 'Treatment'), circle: text(row, 'Circle'), doctorName: text(row, 'Doctors'), hospitalName: text(row, 'Hospitals'),
        paymentType: text(row, 'Payment'), status: text(row, 'Status'), approvedOrCash: text(row, 'Approved/Cash'), paymentCollectedAt: text(row, 'Payment Collected At'), caseType: text(row, 'Type'), leadSource: text(row, 'Lead Source'),
        totalAmount: number(row, 'Total'), billAmount: number(row, 'Bill Amount'), cashOrDedPaid: number(row, 'Cash/Ded. Paid'), referralAmount: number(row, 'Referral Amount'), cabCharges: number(row, 'Cab Charges'), dcCharges: number(row, 'D&C'), implantCost: number(row, 'Implant Cost'),
        hospitalSharePct: number(row, 'Hospital Share %'), hospitalShareAmount: number(row, 'Hospital Share'), doctorCharges: number(row, 'Doctor Charges'), mediendSharePct: number(row, 'MediEND Share %'), mediendShareAmount: number(row, 'MediEND Share'), mediendNetProfit: number(row, 'MediEND Net-Profit'), finalProfit: number(row, 'MediEND Net-Profit'),
        doctorPayoutStatus: text(row, 'Doctor Payment Status'), instrumentsCost: number(row, 'Instuments Charges'), instrumentsPaymentStatus: text(row, 'Instuments Payment Status'), emiSubventionPct: number(row, 'EMI Suvention %'), emiSubventionCharges: number(row, 'EMI Subvention Charges'), cabStatus: text(row, 'Cab Status'), referralPct: number(row, 'Refferal %'), referralStatus: text(row, 'Referral Status'), referralName: text(row, 'Referral'), mediendInvoiceStatus: text(row, 'MediEND Payment Status'),
      }
      const compact = Object.fromEntries(Object.entries(plData).filter(([, value]) => value !== undefined))
      await prisma.$transaction([
        prisma.lead.update({ where: { id: lead.id }, data: { source: text(row, 'Lead Source'), insuranceName: text(row, 'Insurance Company'), tpa: text(row, 'TPA') } }),
        prisma.pLRecord.upsert({ where: { leadId: lead.id }, create: { leadId: lead.id, ...compact, handledById: user.id } as any, update: compact as any }),
      ])
      result.imported += 1
    }
    return successResponse(result)
  } catch (error) { console.error('P&L import failed', error); return errorResponse('P&L import failed', 500) }
}
