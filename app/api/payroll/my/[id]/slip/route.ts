import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { numberToWordsINR } from '@/lib/hrms/salary-calculation'
import path from 'path'
import fs from 'fs'

const MEDIEND_TEAL: [number, number, number] = [44, 110, 106] // #2C6E6A
const MEDIEND_DARK: [number, number, number] = [26, 26, 46]   // #1A1A2E

function getMonthName(month: number): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return months[month - 1] || ''
}

function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
  return `Rs. ${formatted}`
}

function maskPan(pan: string | null | undefined): string {
  if (!pan || pan.length < 4) return '—'
  return 'XXXXX' + pan.slice(-4)
}

function maskBank(account: string | null | undefined): string {
  if (!account || account.replace(/\s/g, '').length < 4) return '—'
  const cleaned = account.replace(/\s/g, '')
  return 'XXXX XXXX ' + cleaned.slice(-4)
}

function getLogoBase64(): string | null {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo-mediend.png')
    const buffer = fs.readFileSync(logoPath)
    return `data:image/png;base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      include: { user: true, department: true },
    })
    if (!employee) return errorResponse('Employee record not found', 404)

    const monthlyPayroll = await prisma.monthlyPayroll.findUnique({
      where: { id },
      include: { employee: { include: { user: true, department: true } } },
    })
    if (monthlyPayroll && monthlyPayroll.employeeId === employee.id) {
      if (monthlyPayroll.status === 'DRAFT') return errorResponse('Payroll not yet released', 404)
      const lateFines = (monthlyPayroll as { lateFines?: number }).lateFines ?? 0
      const salaryStructure = await prisma.salaryStructure.findFirst({
        where: { employeeId: monthlyPayroll.employeeId },
        orderBy: [{ effectiveFrom: 'desc' }],
      })
      const doc = new jsPDF()
      const pageW = (doc as unknown as { internal: { pageSize: { getWidth(): number } } }).internal.pageSize.getWidth()
      const logoData = getLogoBase64()
      if (logoData) {
        doc.addImage(logoData, 'PNG', 20, 10, 36, 14)
      } else {
        doc.setFontSize(18)
        doc.setTextColor(...MEDIEND_TEAL)
        doc.text('mediend', 20, 18)
      }
      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      doc.text('MediEND Healthcare Solutions', 20, 26)
      doc.text('(A unit of Kundkund Healthcare Pvt. Ltd.)', 20, 31)
      doc.setFontSize(12)
      doc.setTextColor(...MEDIEND_TEAL)
      doc.text(`Payslip for ${getMonthName(monthlyPayroll.month)} ${monthlyPayroll.year}`, pageW - 20, 24, { align: 'right' })

      let y = 42
      doc.setFontSize(9)
      doc.setTextColor(...MEDIEND_TEAL)
      doc.text('EMPLOYEE DETAILS', 20, y)
      y += 6
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
      const emp = monthlyPayroll.employee as { designation?: string | null; joinDate?: string | Date | null; panNumber?: string | null; bankAccountNumber?: string | null; uanNumber?: string | null }
      doc.text(`Name: ${monthlyPayroll.employee.user.name}`, 20, y)
      y += 5
      doc.text(`Employee ID: ${monthlyPayroll.employee.employeeCode}`, 20, y)
      y += 5
      doc.text(`Department: ${monthlyPayroll.employee.department?.name || '—'}`, 20, y)
      y += 5
      doc.text(`Designation: ${emp.designation ?? '—'}`, 20, y)
      y += 5
      doc.text(`Date of Joining: ${emp.joinDate ? new Date(emp.joinDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}`, 20, y)
      y += 5
      doc.text(`PAN: ${maskPan(emp.panNumber)}`, 20, y)
      y += 5
      doc.text(`Bank Account: ${maskBank(emp.bankAccountNumber)}`, 20, y)
      y += 5
      doc.text(`UAN: ${emp.uanNumber ?? '—'}`, 20, y)
      y += 8

      doc.setFontSize(9)
      doc.setTextColor(...MEDIEND_TEAL)
      doc.text('ATTENDANCE SUMMARY', 20, y)
      y += 6
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
      doc.text(`Total Days: ${monthlyPayroll.totalDaysInMonth}   Payable Days: ${monthlyPayroll.payableDays}   Half Days: ${monthlyPayroll.halfDays}   Paid Leaves: ${monthlyPayroll.paidLeaves ?? 0}`, 20, y)
      y += 5
      doc.text(`Unpaid/LOP: ${monthlyPayroll.unpaidLeaves}   Late Fines: ${formatCurrency(lateFines)}`, 20, y)
      y += 8

      doc.setFontSize(9)
      doc.setTextColor(...MEDIEND_TEAL)
      doc.text('EARNINGS', 20, y)
      y += 6
      const adjustedHra = (monthlyPayroll as { adjustedHra?: number }).adjustedHra ?? 0
      const earningsRows: [string, string, string][] = [
        ['Basic Salary', salaryStructure?.basicSalary ?? 0, monthlyPayroll.adjustedBasic],
        ['HRA', salaryStructure?.hraAllowance ?? 0, adjustedHra],
        ['Medical Allow.', salaryStructure?.medicalAllowance ?? 0, monthlyPayroll.adjustedMedical],
        ['Conveyance Allow.', salaryStructure?.conveyanceAllowance ?? 0, monthlyPayroll.adjustedConveyance],
        ['Other Allowance', salaryStructure?.otherAllowance ?? 0, monthlyPayroll.adjustedOther],
        ['Special Allow.', salaryStructure?.specialAllowance ?? 0, monthlyPayroll.adjustedSpecial],
      ]
        .filter(([, fixed, earned]) => (fixed as number) > 0 || (earned as number) > 0)
        .map(([label, fixed, earned]) => [
          label as string,
          formatCurrency(Math.round((fixed as number) || 0)),
          formatCurrency(Math.round((earned as number) || 0)),
        ])
      autoTable(doc, {
        startY: y,
        head: [['Description', 'Fixed', 'Earned']],
        body: earningsRows,
        theme: 'plain',
        headStyles: { fillColor: MEDIEND_TEAL as [number, number, number], fontSize: 9 },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        margin: { left: 20 },
        tableWidth: 105,
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
      doc.setFont('helvetica', 'bold')
      doc.text('TOTAL EARNINGS', 20, y)
      doc.text(formatCurrency(monthlyPayroll.adjustedGross), pageW - 20, y, { align: 'right' })
      y += 8

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...MEDIEND_TEAL)
      doc.text('DEDUCTIONS', 20, y)
      y += 6
      const deductions: [string, string][] = [
        [monthlyPayroll.epfEmployee, 'EPF (Employee)'],
        [monthlyPayroll.esicAmount ?? 0, 'ESIC'],
        [monthlyPayroll.insurance ?? 0, 'Miscellaneous'],
        [monthlyPayroll.tdsAmount ?? 0, 'TDS'],
      ]
        .filter(([amt]) => (amt as number) > 0)
        .map(([amt, label]) => [label as string, formatCurrency(amt as number)])
      if (lateFines > 0) {
        deductions.push(['Late fines', formatCurrency(lateFines)])
      }
      autoTable(doc, {
        startY: y,
        head: [['Description', 'Amount']],
        body: deductions,
        theme: 'plain',
        headStyles: { fillColor: MEDIEND_TEAL as [number, number, number], fontSize: 9 },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' } },
        margin: { left: 20 },
        tableWidth: 65,
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
      doc.setFont('helvetica', 'bold')
      doc.text('TOTAL DEDUCTIONS', 20, y)
      doc.text(formatCurrency(monthlyPayroll.totalDeductions), pageW - 20, y, { align: 'right' })
      y += 8

      if (monthlyPayroll.epfEmployer > 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...MEDIEND_TEAL)
        doc.text('EMPLOYER CONTRIBUTIONS (Not deducted from salary)', 20, y)
        y += 6
        doc.setFontSize(9)
        doc.setTextColor(0, 0, 0)
        doc.text(`Employer PF: ${formatCurrency(monthlyPayroll.epfEmployer)}`, 20, y)
        y += 8
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(...MEDIEND_DARK)
      doc.text('NET PAYABLE: ' + formatCurrency(monthlyPayroll.netPayable), 20, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('(Rupees ' + numberToWordsINR(monthlyPayroll.netPayable) + ')', 20, y)
      y += 12

      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text('This is a system-generated payslip and does not require a signature.', pageW / 2, y, { align: 'center' })
      doc.text('Generated on: ' + new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), pageW / 2, y + 5, { align: 'center' })

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
      const empName = monthlyPayroll.employee.user.name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').trim()
      return new Response(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="payslip-${empName}-${monthlyPayroll.month}-${monthlyPayroll.year}.pdf"`,
        },
      })
    }

    const payrollRecord = await prisma.payrollRecord.findUnique({
      where: { id },
      include: { components: true, employee: { include: { user: true, department: true } } },
    })
    if (!payrollRecord || payrollRecord.employeeId !== employee.id) {
      return errorResponse('Payroll record not found', 404)
    }

    const doc = new jsPDF()
    const logoData = getLogoBase64()
    if (logoData) {
      doc.addImage(logoData, 'PNG', 20, 10, 36, 14)
    } else {
      doc.setFontSize(18)
      doc.setTextColor(...MEDIEND_TEAL)
      doc.text('mediend', 20, 18)
    }
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.text('MediEND Healthcare Solutions', 20, 26)
    doc.text(`Payslip for ${getMonthName(payrollRecord.month)} ${payrollRecord.year}`, 20, 34)
    let y = 45
    doc.setFontSize(10)
    doc.text(`Employee: ${employee.user.name}`, 20, y)
    y += 7
    doc.text(`Code: ${employee.employeeCode}`, 20, y)
    y += 7
    doc.text(`Department: ${employee.department?.name || 'N/A'}`, 20, y)
    y += 12
    const allowanceRows: [string, string][] = payrollRecord.basicSalary > 0
      ? [['Basic Salary', formatCurrency(payrollRecord.basicSalary)]]
      : []
    const allowanceComps = payrollRecord.components.filter((c) => c.componentType === 'ALLOWANCE' && c.amount > 0)
    allowanceRows.push(...allowanceComps.map((c) => [c.name, formatCurrency(c.amount)] as [string, string]))
    const deductionComps = payrollRecord.components.filter((c) => c.componentType === 'DEDUCTION' && c.amount > 0)
    const rows: [string, string][] = [
      ...allowanceRows,
      ['Gross', formatCurrency(payrollRecord.grossSalary)],
      ...deductionComps.map((c) => [c.name, '-' + formatCurrency(c.amount)] as [string, string]),
      ['Net Salary', formatCurrency(payrollRecord.netSalary)],
    ]
    autoTable(doc, {
      startY: y,
      head: [['Component', 'Amount']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: MEDIEND_TEAL as [number, number, number] },
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: 'right' } },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    doc.setFontSize(8)
    doc.text('This is a system-generated document.', 105, y, { align: 'center' })

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    const legacyEmpName = employee.user.name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').trim()
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="payslip-${legacyEmpName}-${payrollRecord.month}-${payrollRecord.year}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating salary slip:', error)
    return errorResponse('Failed to generate salary slip', 500)
  }
}
