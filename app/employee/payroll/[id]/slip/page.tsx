'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, Download } from 'lucide-react'
import { format } from 'date-fns'
import { numberToWordsINR } from '@/lib/hrms/salary-calculation'

interface MonthlyPayrollSlip {
  type: 'monthly'
  id: string
  month: number
  year: number
  totalDaysInMonth: number
  payableDays: number
  unpaidLeaves: number
  paidLeaves?: number
  halfDays: number
  lateFines?: number
  adjustedBasic: number
  adjustedHra?: number
  adjustedMedical: number
  adjustedConveyance: number
  adjustedOther: number
  adjustedSpecial: number
  adjustedGross: number
  epfEmployee: number
  applyEsic: boolean
  esicAmount: number
  applyTds: boolean
  tdsAmount: number
  insurance: number
  totalDeductions: number
  epfEmployer: number
  netPayable: number
  status: string
  salaryStructure: {
    basicSalary: number
    hraAllowance: number
    medicalAllowance: number
    conveyanceAllowance: number
    otherAllowance: number
    specialAllowance: number
    monthlyGross: number
    annualCtc: number
  } | null
  employee: {
    id: string
    employeeCode: string
    joinDate: string | null
    designation: string | null
    panNumber: string | null
    bankAccountNumber: string | null
    uanNumber: string | null
    user: { name: string; email: string }
    department: { name: string } | null
  }
}

interface LegacyPayrollSlip {
  type: 'legacy'
  id: string
  month: number
  year: number
  disbursedAt: string
  basicSalary: number
  grossSalary: number
  netSalary: number
  status: string
  components: Array<{ componentType: string; name: string; amount: number }>
  employee: {
    employeeCode: string
    user: { name: string; email: string }
    department: { name: string } | null
  }
}

type PayrollSlipData = MonthlyPayrollSlip | LegacyPayrollSlip

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function maskPan(pan: string | null | undefined) {
  if (!pan || pan.length < 4) return '—'
  return 'XXXXX' + pan.slice(-4)
}

function maskBank(account: string | null | undefined) {
  if (!account || account.replace(/\s/g, '').length < 4) return '—'
  const cleaned = account.replace(/\s/g, '')
  return 'XXXX XXXX ' + cleaned.slice(-4)
}

export default function PayslipPage() {
  const params = useParams()
  const router = useRouter()
  const payrollId = params.id as string

  const { data: payrollData, isLoading } = useQuery<PayrollSlipData>({
    queryKey: ['payroll', payrollId],
    queryFn: () => apiGet<PayrollSlipData>(`/api/payroll/${payrollId}`),
    enabled: !!payrollId,
  })

  const handlePrint = () => window.print()
  const handleDownload = () => window.print()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <p className="text-[#333]">Loading payslip...</p>
      </div>
    )
  }

  if (!payrollData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <p className="text-[#333] mb-4">Payslip not found</p>
          <Button onClick={() => router.back()} className="bg-[#2C6E6A] hover:bg-[#3A8F8B]">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const isMonthly = payrollData.type === 'monthly'
  const monthName = MONTHS[payrollData.month - 1] ?? ''
  const employee = payrollData.employee
  const m = isMonthly ? (payrollData as MonthlyPayrollSlip) : null
  const netPay = isMonthly ? m!.netPayable : (payrollData as LegacyPayrollSlip).netSalary
  const monthlyGross = isMonthly ? m!.adjustedGross : (payrollData as LegacyPayrollSlip).grossSalary

  return (
    <>
      <div className="no-print p-4 bg-[#f0f2f5] border-b flex items-center justify-between sticky top-0 z-10">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button onClick={handleDownload} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Print / Save as PDF
          </Button>
          <Button onClick={handlePrint} className="bg-[#2C6E6A] hover:bg-[#3A8F8B]">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <div className="payslip-page bg-[#f0f2f5] py-8 print:py-0 print:bg-white">
        <div className="slip">
          <div className="header">
            <div className="header-left">
              <div className="logo">medi<span>END</span></div>
              <div className="entity">A unit of Kundkund Healthcare Pvt. Ltd.</div>
            </div>
            <div className="header-right">
              <div className="slip-title">Salary Slip</div>
              <div className="slip-month">{monthName} {payrollData.year}</div>
            </div>
          </div>

          <div className="section">
            <div className="section-title">Employee Details</div>
            <div className="emp-grid">
              <div className="emp-row"><span className="label">Employee Name</span><span className="value">{employee.user.name}</span></div>
              <div className="emp-row"><span className="label">Employee ID</span><span className="value">{employee.employeeCode}</span></div>
              <div className="emp-row"><span className="label">Designation</span><span className="value">{'designation' in employee ? (employee.designation ?? '—') : '—'}</span></div>
              <div className="emp-row"><span className="label">Department</span><span className="value">{employee.department?.name ?? '—'}</span></div>
              <div className="emp-row"><span className="label">Date of Joining</span><span className="value">{'joinDate' in employee && employee.joinDate ? format(new Date(employee.joinDate), 'dd-MMM-yyyy') : '—'}</span></div>
              <div className="emp-row"><span className="label">PAN Number</span><span className="value">{maskPan('panNumber' in employee ? employee.panNumber : null)}</span></div>
              <div className="emp-row"><span className="label">Bank Account</span><span className="value">{maskBank('bankAccountNumber' in employee ? employee.bankAccountNumber : null)}</span></div>
              <div className="emp-row"><span className="label">UAN Number</span><span className="value">{'uanNumber' in employee ? (employee.uanNumber ?? '—') : '—'}</span></div>
            </div>
          </div>

          <hr className="divider" />

          {isMonthly && m && (
            <>
              <div className="section">
                <div className="section-title">Attendance Summary</div>
                <div className="attendance-grid">
                  <div className="att-box"><div className="att-val">{m.totalDaysInMonth}</div><div className="att-label">Total Days</div></div>
                  <div className="att-box"><div className="att-val">{m.payableDays}</div><div className="att-label">Payable Days</div></div>
                  <div className="att-box"><div className="att-val">{m.paidLeaves ?? 0}</div><div className="att-label">Leaves Taken</div></div>
                  <div className="att-box"><div className="att-val">{m.unpaidLeaves}</div><div className="att-label">LOP Days</div></div>
                </div>
              </div>
              <hr className="divider" />
            </>
          )}

          <div className="section">
            <div className="ed-container">
              <div className="ed-col">
                <div className="ed-col-title earnings">Earnings</div>
                {isMonthly && m ? (
                  <>
                    {m.salaryStructure && (
                      <div className="ed-row ed-row-header">
                        <span className="ed-label"></span>
                        <span className="ed-sub-header">Structure</span>
                        <span className="ed-sub-header">Earned</span>
                      </div>
                    )}
                    {(m.adjustedBasic > 0 || (m.salaryStructure?.basicSalary ?? 0) > 0) && (
                      <div className="ed-row">
                        <span className="ed-label">Basic Salary</span>
                        {m.salaryStructure ? <span className="ed-value-struct">{formatCurrency(m.salaryStructure.basicSalary)}</span> : null}
                        <span className="ed-value">{formatCurrency(m.adjustedBasic)}</span>
                      </div>
                    )}
                    {((m.adjustedHra ?? 0) > 0 || (m.salaryStructure?.hraAllowance ?? 0) > 0) && (
                      <div className="ed-row">
                        <span className="ed-label">HRA</span>
                        {m.salaryStructure ? <span className="ed-value-struct">{formatCurrency(m.salaryStructure.hraAllowance)}</span> : null}
                        <span className="ed-value">{formatCurrency(m.adjustedHra ?? 0)}</span>
                      </div>
                    )}
                    {(m.adjustedMedical > 0 || (m.salaryStructure?.medicalAllowance ?? 0) > 0) && (
                      <div className="ed-row">
                        <span className="ed-label">Medical Allowance</span>
                        {m.salaryStructure ? <span className="ed-value-struct">{formatCurrency(m.salaryStructure.medicalAllowance)}</span> : null}
                        <span className="ed-value">{formatCurrency(m.adjustedMedical)}</span>
                      </div>
                    )}
                    {(m.adjustedConveyance > 0 || (m.salaryStructure?.conveyanceAllowance ?? 0) > 0) && (
                      <div className="ed-row">
                        <span className="ed-label">Conveyance Allowance</span>
                        {m.salaryStructure ? <span className="ed-value-struct">{formatCurrency(m.salaryStructure.conveyanceAllowance)}</span> : null}
                        <span className="ed-value">{formatCurrency(m.adjustedConveyance)}</span>
                      </div>
                    )}
                    {(m.adjustedOther > 0 || (m.salaryStructure?.otherAllowance ?? 0) > 0) && (
                      <div className="ed-row">
                        <span className="ed-label">Other Allowance</span>
                        {m.salaryStructure ? <span className="ed-value-struct">{formatCurrency(m.salaryStructure.otherAllowance)}</span> : null}
                        <span className="ed-value">{formatCurrency(m.adjustedOther)}</span>
                      </div>
                    )}
                    {(m.adjustedSpecial > 0 || (m.salaryStructure?.specialAllowance ?? 0) > 0) && (
                      <div className="ed-row">
                        <span className="ed-label">Special Allowance</span>
                        {m.salaryStructure ? <span className="ed-value-struct">{formatCurrency(m.salaryStructure.specialAllowance)}</span> : null}
                        <span className="ed-value">{formatCurrency(m.adjustedSpecial)}</span>
                      </div>
                    )}
                    <div className="ed-total earnings-total">
                      <span>Total Earnings</span>
                      {m.salaryStructure ? <span className="ed-value-struct ed-value">{formatCurrency(m.salaryStructure.monthlyGross)}</span> : null}
                      <span className="ed-value">{formatCurrency(m.adjustedGross)}</span>
                    </div>
                  </>
                ) : (
                  (() => {
                    const leg = payrollData as LegacyPayrollSlip
                    return (
                      <>
                        {leg.basicSalary > 0 && <div className="ed-row"><span className="ed-label">Basic Salary</span><span className="ed-value">{formatCurrency(leg.basicSalary)}</span></div>}
                        {leg.components.filter((c) => c.componentType === 'ALLOWANCE' && c.amount > 0).map((c) => (
                          <div key={c.name} className="ed-row"><span className="ed-label">{c.name}</span><span className="ed-value">{formatCurrency(c.amount)}</span></div>
                        ))}
                        <div className="ed-total earnings-total"><span>Total Earnings</span><span className="ed-value">{formatCurrency(leg.grossSalary)}</span></div>
                      </>
                    )
                  })()
                )}
              </div>
              <div className="ed-col">
                <div className="ed-col-title deductions">Deductions</div>
                {isMonthly && m ? (
                  <>
                    {m.epfEmployee > 0 && <div className="ed-row"><span className="ed-label">EPF (Employee)</span><span className="ed-value">{formatCurrency(m.epfEmployee)}</span></div>}
                    {m.applyEsic && (m.esicAmount ?? 0) > 0 && <div className="ed-row"><span className="ed-label">ESIC</span><span className="ed-value">{formatCurrency(m.esicAmount)}</span></div>}
                    {m.tdsAmount > 0 && <div className="ed-row"><span className="ed-label">TDS</span><span className="ed-value">{formatCurrency(m.tdsAmount)}</span></div>}
                    {(m.insurance + (m.lateFines ?? 0)) > 0 && <div className="ed-row"><span className="ed-label">Other Deductions</span><span className="ed-value">{formatCurrency(m.insurance + (m.lateFines ?? 0))}</span></div>}
                    <div className="ed-total deductions-total"><span>Total Deductions</span><span className="ed-value">{formatCurrency(m.totalDeductions)}</span></div>
                  </>
                ) : (
                  (() => {
                    const leg = payrollData as LegacyPayrollSlip
                    const dedComps = leg.components.filter((c) => c.componentType === 'DEDUCTION' && c.amount > 0)
                    const dedTotal = dedComps.reduce((s, c) => s + c.amount, 0)
                    return (
                      <>
                        {dedComps.map((c) => (
                          <div key={c.name} className="ed-row"><span className="ed-label">{c.name}</span><span className="ed-value">-{formatCurrency(c.amount)}</span></div>
                        ))}
                        <div className="ed-total deductions-total"><span>Total Deductions</span><span className="ed-value">{formatCurrency(dedTotal)}</span></div>
                      </>
                    )
                  })()
                )}
              </div>
            </div>
          </div>

          {isMonthly && m && (m.epfEmployer > 0) && (
            <>
              <hr className="divider" />
              <div className="section" style={{ paddingTop: 12, paddingBottom: 12 }}>
                <div className="section-title">Employer Contributions <span style={{ fontWeight: 400, fontSize: '10px', letterSpacing: 0, textTransform: 'none', color: '#999' }}>(Not deducted from salary)</span></div>
                <div className="employer-grid">
                  <div className="employer-row"><span>Employer PF</span><span className="value">{formatCurrency(m.epfEmployer)}</span></div>
                </div>
              </div>
            </>
          )}

          <div className="net-pay-section">
            <div className="net-label">Net Payable</div>
            <div className="net-amount">{formatCurrency(netPay)}</div>
            <div className="net-words">Rupees {numberToWordsINR(netPay)} Only</div>
          </div>

          <div className="ctc-bar">
            <div>Annual CTC: <span>{isMonthly && m?.salaryStructure ? formatCurrency(m.salaryStructure.annualCtc) : '—'}</span></div>
            <div>Monthly Gross: <span>{isMonthly && m?.salaryStructure ? formatCurrency(m.salaryStructure.monthlyGross) : formatCurrency(monthlyGross)}</span></div>
          </div>

          <div className="footer">
            <span>This is a system-generated payslip and does not require a signature.</span>
            <span>Generated on: {format(new Date(), 'dd-MMM-yyyy hh:mm a')}</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .payslip-page {
          font-family: 'Inter', sans-serif;
          color: #333;
          display: flex;
          justify-content: center;
          padding: 30px;
        }
        .slip {
          width: 800px;
          max-width: 100%;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 4px;
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        }
        .header {
          background: #2C6E6A;
          color: #fff;
          padding: 24px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header-left .logo {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        .header-left .logo span { font-weight: 400; }
        .header-left .entity {
          font-size: 11px;
          opacity: 0.85;
          margin-top: 2px;
        }
        .header-right { text-align: right; }
        .header-right .slip-title { font-size: 18px; font-weight: 600; }
        .header-right .slip-month { font-size: 13px; opacity: 0.9; margin-top: 2px; }
        .section { padding: 16px 32px; }
        .section-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #2C6E6A;
          margin-bottom: 12px;
          padding-bottom: 6px;
          border-bottom: 2px solid #2C6E6A;
        }
        .divider { border: none; border-top: 1px solid #e8e8e8; margin: 0; }
        .emp-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 40px;
        }
        .emp-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          padding: 3px 0;
        }
        .emp-row .label { color: #777; font-weight: 500; }
        .emp-row .value { font-weight: 600; color: #222; }
        .attendance-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
        }
        .att-box {
          text-align: center;
          padding: 12px 8px;
          background: #f7fafa;
          border: 1px solid #e0eded;
        }
        .att-box:first-child { border-radius: 6px 0 0 6px; }
        .att-box:last-child { border-radius: 0 6px 6px 0; }
        .att-box .att-val { font-size: 22px; font-weight: 700; color: #2C6E6A; }
        .att-box .att-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
        .ed-container { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
        .ed-col { padding: 0; }
        .ed-col:first-child { border-right: 1px solid #e8e8e8; padding-right: 24px; }
        .ed-col:last-child { padding-left: 24px; }
        .ed-col-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
          color: #555;
        }
        .ed-col-title.earnings { color: #1a7a4c; }
        .ed-col-title.deductions { color: #c0392b; }
        .ed-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          padding: 6px 0;
          border-bottom: 1px solid #f2f2f2;
        }
        .ed-row-header { padding-bottom: 4px; }
        .ed-sub-header { font-size: 10px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.5px; min-width: 60px; text-align: right; }
        .ed-row .ed-label { color: #555; flex: 1; }
        .ed-row .ed-value { font-weight: 600; color: #222; min-width: 60px; text-align: right; }
        .ed-row .ed-value-struct { font-weight: 400; color: #999; min-width: 60px; text-align: right; font-size: 12px; }
        .ed-row.na .ed-value { color: #bbb; }
        .ed-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          font-weight: 700;
          padding: 10px 0 0;
          margin-top: 8px;
          border-top: 2px solid #ddd;
        }
        .ed-total .ed-value-struct { font-weight: 400; color: #999; min-width: 60px; text-align: right; font-size: 12px; }
        .ed-total.earnings-total .ed-value { color: #1a7a4c; }
        .ed-total.deductions-total .ed-value { color: #c0392b; }
        .employer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 40px;
        }
        .employer-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          padding: 4px 0;
          color: #666;
        }
        .employer-row .value { font-weight: 600; }
        .net-pay-section {
          margin: 0 32px;
          padding: 20px 24px;
          background: linear-gradient(135deg, #2C6E6A 0%, #3A8F8B 100%);
          border-radius: 8px;
          text-align: center;
          color: #fff;
          margin-bottom: 8px;
        }
        .net-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 2px;
          opacity: 0.85;
        }
        .net-amount {
          font-size: 36px;
          font-weight: 700;
          margin: 6px 0;
          letter-spacing: -0.5px;
        }
        .net-words { font-size: 11px; opacity: 0.8; font-style: italic; }
        .ctc-bar {
          display: flex;
          justify-content: center;
          gap: 40px;
          padding: 12px 32px;
          font-size: 12px;
          color: #888;
        }
        .ctc-bar span { font-weight: 600; color: #555; }
        .footer {
          padding: 14px 32px;
          background: #fafafa;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #aaa;
        }
        @media print {
          @page { size: A4; margin: 0.5cm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: white !important; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .payslip-page { padding: 0 !important; background: white !important; }
          .slip { box-shadow: none !important; border: 1px solid #ddd !important; }
        }
      `}</style>
    </>
  )
}
