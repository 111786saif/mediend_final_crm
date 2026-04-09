import { format } from 'date-fns'

interface EmployeeData {
  name: string
  employeeCode: string
  email: string
  department?: string
  joinDate?: Date | null
  salary?: number | null
  designation?: string
}

interface CompanyData {
  name: string
  address: string
  city: string
  state: string
  pincode: string
  email: string
  website: string
  cin: string
}

const COMPANY_DATA: CompanyData = {
  name: 'Kundkund Healthcare Pvt. Ltd.',
  address: 'FF, H-166, Sector 63 Rd, H Block, Sector 63, Noida, Uttar Pradesh 201301',
  city: 'Noida',
  state: 'Uttar Pradesh',
  pincode: '201301',
  email: 'info@mediend.com',
  website: 'www.mediend.com',
  cin: 'U74999UP2022PTC174636',
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.mediend.com'
}

function renderLetterhead(): string {
  const baseUrl = getBaseUrl()
  const logoUrl = `${baseUrl}/images/mediend-logo.png`
  return `
  <div class="letterhead">
    <img src="${logoUrl}" alt="Mediend" style="max-width: 320px; height: auto;" />
  </div>`
}

function renderWatermark(): string {
  const baseUrl = getBaseUrl()
  const logoUrl = `${baseUrl}/images/mediend-logo.png`
  return `
  <div class="watermark">
    <img src="${logoUrl}" alt="" />
  </div>`
}

function renderSignature(): string {
  const baseUrl = getBaseUrl()
  const stampUrl = `${baseUrl}/images/hr-sign-and-stamp.png`
  return `
  <div class="signature">
    <img src="${stampUrl}" alt="Authorized Signature" style="max-width: 180px; height: auto; display: block; margin-bottom: 8px;" />
    <p><strong>Vaishali Tomar</strong></p>
    <p>Senior Manager-Human Resources</p>
  </div>`
}

function renderFooter(): string {
  return `
  <div class="doc-footer">
    <p class="footer-company"><strong>${COMPANY_DATA.name}</strong></p>
    <p class="footer-address">${COMPANY_DATA.address}</p>
    <p class="footer-contact">${COMPANY_DATA.email} | ${COMPANY_DATA.website} | CIN ${COMPANY_DATA.cin}</p>
  </div>`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount)
}

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  if (num === 0) return 'Zero'
  if (num < 20) return ones[num]
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '')
  if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '')
  if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '')
  if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '')
  return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '')
}

const BASE_STYLES = `
  body { font-family: 'Times New Roman', serif; margin: 40px; line-height: 1.6; color: #333; position: relative; }
  .letterhead { margin-bottom: 24px; padding-bottom: 16px; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 0; pointer-events: none; }
  .watermark img { width: 500px; height: auto; opacity: 0.06; }
  .date { text-align: right; margin-bottom: 20px; position: relative; z-index: 1; }
  .subject { font-weight: bold; text-align: center; margin: 20px 0; font-size: 16px; text-decoration: underline; position: relative; z-index: 1; }
  .content { position: relative; z-index: 1; }
  .content p { text-align: justify; margin: 15px 0; }
  .content ul { margin: 15px 0; padding-left: 24px; }
  .content li { margin: 8px 0; }
  .signature { margin-top: 40px; position: relative; z-index: 1; }
  .doc-footer { margin-top: 48px; padding-top: 16px; border-top: 2px solid #14b8a6; font-size: 12px; color: #64748b; position: relative; z-index: 1; }
  .footer-company { font-weight: bold; color: #334155; margin: 4px 0; }
  .footer-address { margin: 4px 0; }
  .footer-contact { margin: 4px 0; }
  @media print { .watermark { position: fixed; } }
`

export function generateOfferLetterHTML(
  employee: EmployeeData,
  metadata?: {
    designation?: string
    ctc?: number
    isSales?: boolean
    salesTarget?: string
    monthlyTarget?: string
    joiningDate?: string
    acceptanceDeadline?: string
    guardianName?: string
    guardianRelation?: string
    address?: string
  }
): string {
  const today = format(new Date(), 'do MMMM, yyyy')
  const designation = metadata?.designation || 'Associate'
  const ctc = metadata?.ctc || employee.salary || 0
  const monthlySalary = Math.round(ctc / 12)
  const guardianName = metadata?.guardianName || ''
  const guardianRelation = metadata?.guardianRelation || 'S/O'
  const address = metadata?.address || ''
  const isSales = metadata?.isSales ?? false
  const salesTarget = metadata?.salesTarget || 'As per performance plan'
  const monthlyTarget = metadata?.monthlyTarget || 'As per performance plan'
  const joiningDateRaw = metadata?.joiningDate || employee.joinDate
  const joiningDate = joiningDateRaw
    ? (typeof joiningDateRaw === 'string'
        ? format(new Date(joiningDateRaw), "do MMMM, yyyy 'at 09:30 AM'")
        : format(joiningDateRaw, "do MMMM, yyyy 'at 09:30 AM'"))
    : 'To be confirmed'
  const acceptanceDeadlineRaw = metadata?.acceptanceDeadline
  const acceptanceDeadline = acceptanceDeadlineRaw
    ? (typeof acceptanceDeadlineRaw === 'string' ? format(new Date(acceptanceDeadlineRaw), 'do MMMM, yyyy') : format(acceptanceDeadlineRaw, 'do MMMM, yyyy'))
    : format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'do MMMM, yyyy')

  const salesSection = isSales
    ? `
    <h4 style="margin-top: 24px; margin-bottom: 8px;">Sales Commitment</h4>
    <p>The Employee has to complete all his/her Sales &amp; Revenue Targets which has been decided &amp; committed by the Employee. If Employee fails to achieve the desired targets, in such cases company will issue the PIP or can be asked to leave the company with immediate effect.</p>
    <p>We believe in recognizing and rewarding exceptional performance. If you achieve your targets, you will benefit from a performance-based appraisal in six months, which could lead to a salary increase or enhanced benefits. Additionally, successful performance may open doors for internal promotions, allowing you to further develop your career within our organization.</p>
    <p><strong>Initial Sales Target:</strong> ${salesTarget}</p>
    <p><strong>Target per month:</strong> ${monthlyTarget}</p>
    <p><em>Target can be changed as per the performance.</em></p>
    <p>Employee would also be eligible for Monthly incentives on Quarterly basis as per the consistent performance. You will have to achieve the desired target which you have been committed. You will have sales and revenue targets to meet, as specified in your performance plan. If you are unable to fulfill your targets after PIP, you will be required to leave the company immediately.</p>
    `
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${BASE_STYLES}</style>
</head>
<body>
  ${renderWatermark()}
  ${renderLetterhead()}

  <div class="date">
    <p>Date: ${today}</p>
    <p>Ref: KUNDKUND/HR/OFFER/${employee.employeeCode}/${format(new Date(), 'yyyy')}</p>
  </div>

  <div>
    <p><strong>To,</strong></p>
    <p>Ms/Mr ${employee.name}${guardianName ? `, ${guardianRelation} ${guardianName}` : ''}</p>${address ? `
    <p>${address}</p>` : ''}
    <p>Email: ${employee.email}</p>
  </div>

  <div class="subject">OFFER LETTER</div>

  <div class="content">
    <p>Dear ${employee.name},</p>

    <p>With reference to your interview for seeking employment with the organization, we are pleased to offer you the post of <strong>${designation}</strong> in the <strong>${employee.department || 'Operations'}</strong> Department with Kundkund Healthcare Pvt. Ltd. We are delighted to make you the following job offer.</p>

    <p>The position we are offering you is at Gross Monthly Salary of INR ${monthlySalary.toLocaleString('en-IN')} with an annual cost to company INR ${ctc.toLocaleString('en-IN')} (${numberToWords(ctc)} Rupees Only) (Including TDS as per Govt Rule of India) (Individual Medical Insurance, Employee &amp; Employer Provident Fund portion will be a part of your cost to company if opted).</p>

    <p>You will be paid your salary monthly after giving effect to withholding(s) as required by law. Any Income Tax applicable on your remuneration or any other payment made by the Company in respect to taxes will be borne by you and as required by law, will be deducted at source.</p>

    <p>Your hours of work will be as per the Company policy and requirement of the project you are working on. You shall always be subject to overall policy of the company and agree to be bound by the same.</p>

    <p>This position is offered subject to satisfactory reference and pre-employment checks by third party vendors/Kundkund Healthcare and completion of Six-month probation period during which time your performance will be reviewed.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Non-Solicitation and Non-Hire of Company Employees</h4>
    <p>You agree that during the term of your employment and a further period of 12 (twelve) calendar months after separation from the Company, for whatever reasons, you shall not either directly or indirectly solicit or entice away or endeavor to solicit or to entice away or assist any other person to solicit or hire or entice away from the Company, any Company employee.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Confidentiality &amp; Non-Compete and Non-Solicitation</h4>
    <p>You agree not to share your salary or any confidential company information, not to join any competitor as an employee or contractor, and not to solicit any employee of the Company to join another organization.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Transfer &amp; Relocation</h4>
    <p>You may be transferred in such capacity as the company may from time to time determine to any other location, department, establishment, factory or branch of the company or its affiliate, associate or subsidiary companies. You agree that you are willing to travel to such places, within or outside India, as the Company may from time to time require in relation to Company's business.</p>

    <p>All information, data and documents shared by the Company with you are the intellectual property of the Company and you will at all times maintain the confidentiality of all the information, data and documents shared with you, including this offer letter.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Confidentiality &amp; Integrity Issue</h4>
    <p>The Employee shall not disclose, at any time to any person who is not employed, part of or associated with the Company; or use for any purpose that is not within the scope of his services, any Confidential Information. The Employee shall not be a part of same business involvement/Freelancing while working with Kundkund Healthcare. The Employee shall not be a part of sharing Kundkund Healthcare business leads outside the company with any of the person/Doctor/Hospital. In such cases employee can be asked to leave the company with immediate effect without salary.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Termination of Employment</h4>
    <p>Termination of the employment for "cause": The Company may terminate Employee's employment without notice in the event of non-performance, willful or serious misconduct on Employee's part. Termination in case the Employee is absconding from work: In case the Employee is absent from his official duty continuously for 3 (Three) or more days without any information, the Employee shall be deemed to have left and relinquished the service on his own accord.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Probation</h4>
    <p>The Employee has to pursue 6 Months' probation period with the Kundkund Healthcare. During Probation period your notice period would be of 15 Days.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Leaves Under Probation</h4>
    <p>Casual Leave: 6 Leaves (1 per month), Sick Leave: 3 Leaves (0.5 per month), Earned Leave: 3 Leaves (1 per month) - credited after successful completion of 6 months' probation period.</p>
    ${salesSection}

    <p>Initially, you will be posted at our Noida office (Address: FF, H-166, Sector-63, Noida 201301). This position reports to HOD. Your working hours will be intimated by your reporting manager.</p>

    <p>We would like you to start work on <strong>${joiningDate}</strong>. If this date is not acceptable, please contact undersigned immediately.</p>

    <p>Please sign the enclosed copy of this letter and return it to undersigned by <strong>${acceptanceDeadline}</strong> to indicate your acceptance of this offer.</p>

    <p>We are confident you will be able to make a significant contribution to the success of our Kundkund Healthcare Limited and look forward to working with you.</p>
  </div>

  <div style="margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <p>Sincerely</p>
      ${renderSignature()}
    </div>
    <div style="text-align: right;">
      <p><strong>Employee Acceptance</strong></p>
      <p>Signature: _________________</p>
      <p>Date: _________________</p>
    </div>
  </div>

  <div style="margin-top: 40px; border-top: 1px dashed #999; padding-top: 20px;">
    <p><strong>Acceptance:</strong></p>
    <p>I, ${employee.name}${guardianName ? `, ${guardianRelation} ${guardianName}` : ''}${address ? `, residing at ${address}` : ''}, hereby accept the offer of employment as mentioned above.</p>
    <!-- ACK_PLACEHOLDER -->
  </div>

  ${renderFooter()}
</body>
</html>`
}

export function generateIncrementLetterHTML(
  employee: EmployeeData,
  metadata?: {
    designation?: string
    previousSalary?: number
    newSalary?: number
    incrementPercentage?: number
    effectiveDate?: string
    joinDate?: string
    remarks?: string
  }
): string {
  const today = format(new Date(), 'do MMMM, yyyy')
  const designation = metadata?.designation || employee.designation || 'Associate'
  const previousSalary = metadata?.previousSalary || employee.salary || 0
  const incrementPercentage = metadata?.incrementPercentage || 10
  const newSalary = metadata?.newSalary || Math.round(previousSalary * (1 + incrementPercentage / 100))
  const newMonthlySalary = Math.round(newSalary / 12)
  const effectiveDateRaw = metadata?.effectiveDate
  const effectiveDate = effectiveDateRaw
    ? (typeof effectiveDateRaw === 'string' ? format(new Date(effectiveDateRaw), 'do MMMM, yyyy') : format(effectiveDateRaw, 'do MMMM, yyyy'))
    : format(new Date(), 'do MMMM, yyyy')
  const joinDateRaw = metadata?.joinDate || employee.joinDate
  const joinDate = joinDateRaw
    ? (typeof joinDateRaw === 'string' ? format(new Date(joinDateRaw), 'do MMMM, yyyy') : format(joinDateRaw, 'do MMMM, yyyy'))
    : 'N/A'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${BASE_STYLES}</style>
</head>
<body>
  ${renderWatermark()}
  ${renderLetterhead()}

  <div class="date">
    <p>Date: ${today}</p>
    <p>Ref: KUNDKUND/HR/INCREMENT/${employee.employeeCode}/${format(new Date(), 'yyyy')}</p>
  </div>

  <div>
    <p><strong>To,</strong></p>
    <p>Mr/Ms ${employee.name}</p>
    <p>Employee ID: ${employee.employeeCode}</p>
    <p>Department: ${employee.department || 'N/A'}</p>
  </div>

  <div>
    <p><strong>Company - Kundkund Healthcare Pvt. Ltd.</strong></p>
    <p>Add - H-166 First Floor, Sector 63, Noida, 201301</p>
  </div>

  <div class="subject">SALARY INCREMENT LETTER</div>

  <div class="content">
    <p>Dear ${employee.name},</p>

    <p>As we reflect on the progress and achievements over the past year, it brings me immense joy to acknowledge your contributions to Kundkund Healthcare Pvt Ltd. Since joining us as a <strong>${designation}</strong> on ${joinDate}, your exemplary performance and unwavering commitment have played a pivotal role in driving our mission forward.</p>

    <p>Your remarkable ability to foster relationships, identify new opportunities, and execute strategic initiatives has not only exceeded expectations but has also made a significant impact on our team and the company's growth trajectory. Your contributions resonate with our core values, and we are truly grateful to have you on board.</p>

    <p>In recognition of your hard work and dedication, we are excited to announce a salary increment of <strong>${incrementPercentage}%</strong>, effective from <strong>${effectiveDate}</strong>. Your new monthly salary will be <strong>INR ${newMonthlySalary.toLocaleString('en-IN')}</strong> (Annual CTC: ${formatCurrency(newSalary)}). This increment reflects not just your past performance but also our confidence in your future contributions to our success.</p>

    ${metadata?.remarks ? `<p><strong>Remarks:</strong> ${metadata.remarks}</p>` : ''}

    <p>At Kundkund Healthcare, we are committed to fostering a culture of excellence and continuous improvement, and we are thrilled to support your professional journey. We look forward to witnessing your continued growth and the positive impact you will undoubtedly make in the future.</p>

    <p>Congratulations on this well-deserved recognition! Let's continue to achieve great things together.</p>
  </div>

  ${renderSignature()}

  ${renderFooter()}
</body>
</html>`
}

export function generateExperienceLetterHTML(
  employee: EmployeeData,
  metadata?: {
    designation?: string
    lastWorkingDate?: string
  }
): string {
  const today = format(new Date(), 'do MMMM, yyyy')
  const designation = metadata?.designation || 'Associate'
  const lastWorkingDate = metadata?.lastWorkingDate || today
  const joinDateFormatted = employee.joinDate ? format(employee.joinDate, 'do MMMM, yyyy') : 'N/A'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${BASE_STYLES}</style>
</head>
<body>
  ${renderWatermark()}
  ${renderLetterhead()}

  <div class="date">
    <p>Date: ${today}</p>
    <p>Ref: KUNDKUND/HR/EXP/${employee.employeeCode}/${format(new Date(), 'yyyy')}</p>
  </div>

  <div class="subject">EXPERIENCE CERTIFICATE</div>

  <div class="content">
    <p><strong>TO WHOMSOEVER IT MAY CONCERN</strong></p>

    <p>This is to certify that Mr/Ms <strong>${employee.name}</strong> was employed with Kundkund Healthcare Pvt. Ltd. from <strong>${joinDateFormatted}</strong> to <strong>${lastWorkingDate}</strong> in the capacity of <strong>${designation}</strong>.</p>

    <p>During the tenure with our organization, ${employee.name.split(' ')[0]} demonstrated a high level of professionalism, commitment, and responsibility in carrying out assigned duties. ${employee.name.split(' ')[0]} consistently displayed strong work ethics, effective communication skills, and the ability to work both independently and as part of a team.</p>

    <p>His/Her contribution to the organization was valuable, and performance throughout the employment period was found to be commendable. ${employee.name.split(' ')[0]} maintained excellent conduct and adhered to company policies and standards at all times.</p>

    <p>This letter is being issued upon the employee's request for professional and official purposes.</p>

    <p>We appreciate his/her contributions and wish him/her continued success in all future professional endeavors.</p>
  </div>

  <div style="margin-top: 40px;">
    <p>For Kundkund Healthcare Pvt. Ltd.</p>
    ${renderSignature()}
  </div>

  ${renderFooter()}
</body>
</html>`
}

export function generateRelievingLetterHTML(
  employee: EmployeeData,
  metadata?: {
    designation?: string
    lastWorkingDate?: string
    resignationDate?: string
  }
): string {
  const today = format(new Date(), 'do MMMM, yyyy')
  const designation = metadata?.designation || 'Associate'
  const lastWorkingDate = metadata?.lastWorkingDate || today
  const resignationDate = metadata?.resignationDate || format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'do MMMM, yyyy')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${BASE_STYLES}</style>
</head>
<body>
  ${renderWatermark()}
  ${renderLetterhead()}

  <div class="date">
    <p>Date: ${today}</p>
    <p>Ref: KUNDKUND/HR/REL/${employee.employeeCode}/${format(new Date(), 'yyyy')}</p>
  </div>

  <div class="subject">RELIEVING LETTER</div>

  <div class="content">
    <p><strong>${employee.name}</strong></p>
    <p>Employee Code: ${employee.employeeCode}</p>
    <br>

    <p>Dear ${employee.name},</p>

    <p>With reference to your resignation letter dated <strong>${resignationDate}</strong>, we hereby confirm that you have been relieved from your duties as <strong>${designation}</strong> at ${COMPANY_DATA.name} with effect from <strong>${lastWorkingDate}</strong>.</p>

    <p>During your tenure from <strong>${employee.joinDate ? format(employee.joinDate, 'do MMMM, yyyy') : 'N/A'}</strong> to <strong>${lastWorkingDate}</strong>, your services were found satisfactory.</p>

    <p>You have completed all handover formalities and cleared all company dues. There are no financial or material obligations pending from your side.</p>

    <p>We thank you for your contributions to the organization and wish you success in your future endeavors.</p>
  </div>

  <div style="margin-top: 40px;">
    <p>For ${COMPANY_DATA.name}</p>
    ${renderSignature()}
  </div>

  ${renderFooter()}
</body>
</html>`
}

export function generateInternshipOfferLetterHTML(
  employee: EmployeeData,
  metadata?: {
    designation?: string
    stipend?: number
    duration?: string
    startDate?: string
    department?: string
    location?: string
    internshipType?: string
    acceptanceDeadline?: string
    guardianName?: string
    guardianRelation?: string
    address?: string
  }
): string {
  const today = format(new Date(), 'do MMMM, yyyy')
  const designation = metadata?.designation || 'Intern'
  const stipend = metadata?.stipend || 0
  const duration = metadata?.duration || '3 Months'
  const department = metadata?.department || employee.department || 'Operations'
  const location = metadata?.location || 'FF, H-166, Sector-63, Noida 201301'
  const internshipType = metadata?.internshipType || 'Full-time'
  const guardianName = metadata?.guardianName || ''
  const guardianRelation = metadata?.guardianRelation || 'S/O'
  const address = metadata?.address || ''
  const startDateRaw = metadata?.startDate
  const startDate = startDateRaw
    ? format(new Date(startDateRaw), 'do MMMM, yyyy')
    : 'To be confirmed'
  const acceptanceDeadlineRaw = metadata?.acceptanceDeadline
  const acceptanceDeadline = acceptanceDeadlineRaw
    ? format(new Date(acceptanceDeadlineRaw), 'do MMMM, yyyy')
    : format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'do MMMM, yyyy')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${BASE_STYLES}
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .details-table td { padding: 8px 12px; border: 1px solid #ddd; }
    .details-table td:first-child { font-weight: bold; width: 40%; background: #f8fafc; }
  </style>
</head>
<body>
  ${renderWatermark()}
  ${renderLetterhead()}

  <div class="date">
    <p>Date: ${today}</p>
    <p>Ref: KUNDKUND/HR/INTERN-OFFER/${employee.employeeCode}/${format(new Date(), 'yyyy')}</p>
  </div>

  <div>
    <p><strong>To,</strong></p>
    <p>Ms/Mr ${employee.name}${guardianName ? `, ${guardianRelation} ${guardianName}` : ''}</p>${address ? `
    <p>${address}</p>` : ''}
    <p>Email: ${employee.email}</p>
  </div>

  <div class="subject">INTERNSHIP OFFER LETTER</div>

  <div class="content">
    <p>Dear ${employee.name},</p>

    <p>We are pleased to extend to you an offer for an internship position at <strong>${COMPANY_DATA.name}</strong> as a <strong>${designation}</strong>. This internship is scheduled to begin on <strong>${startDate}</strong>.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Details of the Internship</h4>

    <table class="details-table">
      <tr><td>Position</td><td>${designation}</td></tr>
      <tr><td>Duration of Internship</td><td>${duration}</td></tr>
      <tr><td>Department</td><td>${department}</td></tr>
      <tr><td>Location</td><td>${location}</td></tr>
      <tr><td>Compensation</td><td>${stipend > 0 ? `INR ${stipend.toLocaleString('en-IN')} per month` : 'Unpaid'}</td></tr>
      <tr><td>Type of Internship</td><td>${internshipType}</td></tr>
    </table>

    <p>During the internship, you will be expected to adhere to the company's rules, regulations, and policies. You shall maintain strict confidentiality regarding all proprietary information of the company.</p>

    <p>Please confirm your acceptance by signing and returning this letter by <strong>${acceptanceDeadline}</strong>. We look forward to having you on our team!</p>
  </div>

  <div style="margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <p>Sincerely</p>
      ${renderSignature()}
    </div>
    <div style="text-align: right;">
      <p><strong>Intern Acceptance</strong></p>
      <p>Signature: _________________</p>
      <p>Date: _________________</p>
    </div>
  </div>

  <div style="margin-top: 40px; border-top: 1px dashed #999; padding-top: 20px;">
    <p><strong>Acceptance:</strong></p>
    <p>I, ${employee.name}${guardianName ? `, ${guardianRelation} ${guardianName}` : ''}${address ? `, residing at ${address}` : ''}, hereby accept the offer of internship as mentioned above.</p>
    <!-- ACK_PLACEHOLDER -->
  </div>

  ${renderFooter()}
</body>
</html>`
}

export function generateInternshipCompletionLetterHTML(
  employee: EmployeeData,
  metadata?: {
    designation?: string
    department?: string
    startDate?: string
    endDate?: string
  }
): string {
  const today = format(new Date(), 'do MMMM, yyyy')
  const designation = metadata?.designation || 'Intern'
  const department = metadata?.department || employee.department || 'Operations'
  const startDateRaw = metadata?.startDate
  const startDate = startDateRaw
    ? format(new Date(startDateRaw), 'do MMMM, yyyy')
    : (employee.joinDate ? format(employee.joinDate, 'do MMMM, yyyy') : 'N/A')
  const endDateRaw = metadata?.endDate
  const endDate = endDateRaw
    ? format(new Date(endDateRaw), 'do MMMM, yyyy')
    : today

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${BASE_STYLES}</style>
</head>
<body>
  ${renderWatermark()}
  ${renderLetterhead()}

  <div class="date">
    <p>Date: ${today}</p>
    <p>Ref: KUNDKUND/HR/INTERN-COMP/${employee.employeeCode}/${format(new Date(), 'yyyy')}</p>
  </div>

  <div class="subject">INTERNSHIP COMPLETION CERTIFICATE</div>

  <div class="content">
    <p><strong>TO WHOMSOEVER IT MAY CONCERN</strong></p>

    <p>We are glad to inform that Ms./Mr. <strong>${employee.name}</strong> has successfully completed the internship at <strong>${COMPANY_DATA.name}</strong> from <strong>${startDate}</strong> to <strong>${endDate}</strong>.</p>

    <p>During the internship, ${employee.name.split(' ')[0]} was exposed to the various activities in the <strong>${department}</strong> Department.</p>

    <p>We found ${employee.name.split(' ')[0]} extremely inquisitive and hard working. ${employee.name.split(' ')[0]} was very much interested to learn the functions of our core division and was willing to put the best efforts and get into the depth of the subject to understand it better.</p>

    <p>The association with us was very fruitful and we wish ${employee.name.split(' ')[0]} all the best in future endeavors.</p>
  </div>

  <div style="margin-top: 40px;">
    <p>For ${COMPANY_DATA.name}</p>
    <p>Thanks &amp; Regards</p>
    ${renderSignature()}
  </div>

  ${renderFooter()}
</body>
</html>`
}
