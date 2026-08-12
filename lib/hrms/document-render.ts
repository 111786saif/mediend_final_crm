import { format } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { mergeTemplatePlaceholders, extractBodyHtml, stripDocumentChrome, formatLetterDate, LETTER_DATETIME_FORMAT } from '@/lib/hrms/document-merge'
import {
  DEFAULT_TEMPLATE_BODIES,
  DOCUMENT_TEMPLATE_NAMES,
  TEMPLATE_EXTRA_STYLES,
} from '@/lib/hrms/document-default-templates'
import {
  buildDocumentHtml,
  getSignatureHtml,
  resolveDocumentDate,
  type DocumentGenerationOptions,
  COMPANY_DATA,
  formatCurrency,
  numberToWords,
  generateOfferLetterHTML,
  generateIncrementLetterHTML,
  generateExperienceLetterHTML,
  generateRelievingLetterHTML,
  generateInternshipOfferLetterHTML,
  generateInternshipCompletionLetterHTML,
  generateExitInterviewHTML,
} from '@/lib/hrms/document-templates'

export type EmployeeData = {
  name: string
  employeeCode: string
  email: string
  department?: string
  joinDate?: Date | null
  salary?: number | null
  designation?: string
}

export type DocumentTypeKey =
  | 'OFFER_LETTER'
  | 'INCREMENT_LETTER'
  | 'EXPERIENCE_LETTER'
  | 'RELIEVING_LETTER'
  | 'INTERNSHIP_OFFER_LETTER'
  | 'INTERNSHIP_COMPLETION_LETTER'
  | 'EXIT_INTERVIEW_FORM'

function yesNo(val: unknown): string {
  if (val === 'yes') return 'Yes'
  if (val === 'no') return 'No'
  return '—'
}

function assetStatus(val: unknown): string {
  return val === 'on' ? 'Returned' : '—'
}

function assetRow(label: string, status: unknown, comment: unknown): string {
  const statusVal = assetStatus(status)
  const statusColor = statusVal === 'Returned' ? '#16a34a' : '#dc2626'
  return `
  <tr>
    <td style="padding:8px;border:1px solid #e2e8f0;">${label}</td>
    <td style="padding:8px;text-align:center;border:1px solid #e2e8f0;font-weight:600;color:${statusColor};">${statusVal}</td>
    <td style="padding:8px;border:1px solid #e2e8f0;">${(comment as string) || '—'}</td>
  </tr>`
}

export function buildMergeVars(
  documentType: DocumentTypeKey,
  employee: EmployeeData,
  metadata?: Record<string, unknown> | null,
  options?: DocumentGenerationOptions
): Record<string, string> {
  const m = metadata || {}
  const documentDate = resolveDocumentDate(options)
  const today = format(documentDate, 'do MMMM, yyyy')
  const year = format(documentDate, 'yyyy')
  const salutation = (m.salutation as string) || 'Mr.'
  const designation =
    (m.designation as string) ||
    (m.position as string) ||
    employee.designation ||
    (documentType.includes('INTERNSHIP') ? 'Intern' : 'Associate')
  const department = (m.department as string) || employee.department || 'Operations'
  const guardianName = (m.guardianName as string) || ''
  const guardianRelation = (m.guardianRelation as string) || 'S/O'
  const address = (m.address as string) || ''
  const guardianLine = guardianName ? `, ${guardianRelation} ${guardianName}` : ''
  const addressBlock = address ? `\n    <p>${address}</p>` : ''
  const addressAcceptance = address ? `, residing at ${address}` : ''
  const firstName = employee.name.split(' ')[0] || employee.name
  const signatureHtml = getSignatureHtml(documentDate)

  const base: Record<string, string> = {
    employeeName: (m.employeeName as string) || employee.name,
    employeeCode: (m.employeeCode as string) || employee.employeeCode,
    employeeEmail: employee.email,
    department,
    designation,
    salutation,
    today,
    year,
    companyName: COMPANY_DATA.name,
    companyAddress: COMPANY_DATA.address,
    guardianName,
    guardianRelation,
    address,
    guardianLine,
    addressBlock,
    addressAcceptance,
    firstName,
    signatureHtml,
    joinDate: formatLetterDate(
      (m.joinDate as string) || (m.dateOfJoining as string) || employee.joinDate,
      'N/A'
    ),
  }

  switch (documentType) {
    case 'OFFER_LETTER': {
      const ctc = Number(m.ctc ?? employee.salary ?? 0)
      const monthlySalary = Math.round(ctc / 12)
      const isSales = Boolean(m.isSales)
      const salesTarget = (m.salesTarget as string) || 'As per performance plan'
      const monthlyTarget = (m.monthlyTarget as string) || 'As per performance plan'
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
      return {
        ...base,
        refNumber: `KUNDKUND/HR/OFFER/${employee.employeeCode}/${year}`,
        ctc: ctc.toLocaleString('en-IN'),
        ctcWords: numberToWords(ctc),
        monthlySalary: monthlySalary.toLocaleString('en-IN'),
        joiningDate: formatLetterDate(
          (m.joiningDate as string) || employee.joinDate,
          'To be confirmed',
          LETTER_DATETIME_FORMAT
        ),
        acceptanceDeadline: formatLetterDate(
          m.acceptanceDeadline as string,
          formatLetterDate(new Date(documentDate.getTime() + 7 * 24 * 60 * 60 * 1000))
        ),
        salesSection,
      }
    }
    case 'INCREMENT_LETTER': {
      const previousSalary = Number(m.previousSalary ?? employee.salary ?? 0)
      const incrementPercentage = Number(m.incrementPercentage ?? 10)
      const newSalary =
        Number(m.newSalary) || Math.round(previousSalary * (1 + incrementPercentage / 100))
      const newMonthlySalary = Math.round(newSalary / 12)
      const remarks = (m.remarks as string) || ''
      return {
        ...base,
        refNumber: `KUNDKUND/HR/INCREMENT/${employee.employeeCode}/${year}`,
        previousSalary: previousSalary.toLocaleString('en-IN'),
        newSalary: newSalary.toLocaleString('en-IN'),
        newSalaryFormatted: formatCurrency(newSalary),
        newMonthlySalary: newMonthlySalary.toLocaleString('en-IN'),
        incrementPercentage: String(incrementPercentage),
        effectiveDate: formatLetterDate(m.effectiveDate as string, today),
        remarks,
        remarksBlock: remarks ? `<p><strong>Remarks:</strong> ${remarks}</p>` : '',
      }
    }
    case 'EXPERIENCE_LETTER':
      return {
        ...base,
        refNumber: `KUNDKUND/HR/EXP/${employee.employeeCode}/${year}`,
        lastWorkingDate: formatLetterDate(m.lastWorkingDate as string, today),
      }
    case 'RELIEVING_LETTER':
      return {
        ...base,
        refNumber: `KUNDKUND/HR/REL/${employee.employeeCode}/${year}`,
        lastWorkingDate: formatLetterDate(m.lastWorkingDate as string, today),
        resignationDate: formatLetterDate(
          m.resignationDate as string,
          formatLetterDate(new Date(documentDate.getTime() - 30 * 24 * 60 * 60 * 1000))
        ),
      }
    case 'INTERNSHIP_OFFER_LETTER': {
      const stipend = Number(m.stipend ?? 0)
      return {
        ...base,
        refNumber: `KUNDKUND/HR/INTERN-OFFER/${employee.employeeCode}/${year}`,
        stipend: stipend.toLocaleString('en-IN'),
        stipendDisplay: stipend > 0 ? `INR ${stipend.toLocaleString('en-IN')} per month` : 'Unpaid',
        duration: (m.duration as string) || '3 Months',
        startDate: formatLetterDate(m.startDate as string, 'To be confirmed'),
        location:
          (m.location as string) ||
          '6th Floor, Plot No. 56A/16, Block C, Phase 2, Industrial Area, Sector 62, Noida, Uttar Pradesh 201309',
        internshipType: (m.internshipType as string) || 'Full-time',
        acceptanceDeadline: formatLetterDate(
          m.acceptanceDeadline as string,
          formatLetterDate(new Date(documentDate.getTime() + 7 * 24 * 60 * 60 * 1000))
        ),
      }
    }
    case 'INTERNSHIP_COMPLETION_LETTER':
      return {
        ...base,
        refNumber: `KUNDKUND/HR/INTERN-COMP/${employee.employeeCode}/${year}`,
        startDate: formatLetterDate(
          (m.startDate as string) || employee.joinDate,
          'N/A'
        ),
        endDate: formatLetterDate(m.endDate as string, today),
      }
    case 'EXIT_INTERVIEW_FORM': {
      const culture = m.companyCulture
        ? String(m.companyCulture)
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : '—'
      const workEnv = m.workEnvironment
        ? String(m.workEnvironment).charAt(0).toUpperCase() + String(m.workEnvironment).slice(1)
        : '—'
      let noticePeriodDetail = '—'
      if (m.noticePeriodServed === 'yes' && m.noticePeriodDays) {
        noticePeriodDetail = String(m.noticePeriodDays)
      } else if (m.noticePeriodServed === 'no' && m.noticePeriodReason) {
        noticePeriodDetail = String(m.noticePeriodReason)
      }
      const propertyTable = `
    <table style="width:100%;border-collapse:collapse;">
      <tr style="background:#f8fafc;">
        <th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Item</th>
        <th style="padding:8px;text-align:center;border:1px solid #e2e8f0;width:80px;">Status</th>
        <th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Comments</th>
      </tr>
      ${assetRow('Laptop / Desktop', m.laptopReturned, m.laptopComments)}
      ${assetRow('Employee ID Card', m.idCardReturned, m.idCardStatusComments)}
      ${assetRow('Access Card', m.accessCardReturned, m.accessCardComments)}
      ${assetRow('SIM Card', m.simCardReturned, m.simCardStatusComments)}
      ${assetRow('WhatsApp Backup', m.whatsappBackupReturned, m.whatsappBackupComments)}
      ${assetRow('Mobile Phone', m.mobilePhoneReturned, m.mobilePhoneComments)}
      ${assetRow('Work-Related Info / Assets', m.workInfoReturned, m.workInfoComments)}
      ${assetRow('Email ID Backup', m.emailBackupReturned, m.emailBackupComments)}
      ${assetRow('Passwords (all accounts/systems)', m.passwordsReturned, m.passwordsComments)}
    </table>`
      return {
        ...base,
        lastWorkingDate: formatLetterDate(m.lastWorkingDay as string, '—'),
        reasonForLeaving: (m.reasonForLeaving as string) || '—',
        jobRoleMatch: yesNo(m.jobRoleMatch),
        jobRoleComments: (m.jobRoleComments as string) || '—',
        workEnvironment: workEnv,
        workEnvironmentComments: (m.workEnvironmentComments as string) || '—',
        companyCulture: culture,
        companyCultureComments: (m.companyCultureComments as string) || '—',
        suggestions: (m.suggestions as string) || '—',
        noticePeriodServed: yesNo(m.noticePeriodServed),
        noticePeriodDetail,
        handoverCompleted: yesNo(m.handoverCompleted),
        handoverReason: (m.handoverReason as string) || '—',
        emailAccessRemoved: yesNo(m.emailAccessRemoved),
        emailAccessComments: (m.emailAccessComments as string) || '—',
        otherAccessRemoved: yesNo(m.otherAccessRemoved),
        otherAccessComments: (m.otherAccessComments as string) || '—',
        idCardsReturned: yesNo(m.idCardsReturned),
        idCardsComments: (m.idCardsComments as string) || '—',
        simCardsReturned: yesNo(m.simCardsReturned),
        simCardsComments: (m.simCardsComments as string) || '—',
        workAssetsReturned: yesNo(m.workAssetsReturned),
        workAssetsComments: (m.workAssetsComments as string) || '—',
        backupReceived: yesNo(m.backupReceived),
        backupRemarks: (m.backupRemarks as string) || '—',
        hrExitCompleted: yesNo(m.hrExitCompleted),
        hrRemarks: (m.hrRemarks as string) || '—',
        wouldConsiderFuture: yesNo(m.wouldConsiderFuture),
        wouldConsiderComments: (m.wouldConsiderComments as string) || '—',
        propertyTable,
      }
    }
    default:
      return base
  }
}

function legacyGenerate(
  documentType: DocumentTypeKey,
  employee: EmployeeData,
  metadata?: Record<string, unknown> | null,
  options?: DocumentGenerationOptions
): string {
  const meta = metadata || undefined
  switch (documentType) {
    case 'OFFER_LETTER':
      return generateOfferLetterHTML(employee, meta as any, options)
    case 'INCREMENT_LETTER':
      return generateIncrementLetterHTML(employee, meta as any, options)
    case 'EXPERIENCE_LETTER':
      return generateExperienceLetterHTML(employee, meta as any, options)
    case 'RELIEVING_LETTER':
      return generateRelievingLetterHTML(employee, meta as any, options)
    case 'INTERNSHIP_OFFER_LETTER':
      return generateInternshipOfferLetterHTML(employee, meta as any, options)
    case 'INTERNSHIP_COMPLETION_LETTER':
      return generateInternshipCompletionLetterHTML(employee, meta as any, options)
    case 'EXIT_INTERVIEW_FORM':
      return generateExitInterviewHTML(employee, meta as any)
    default:
      return '<p>Document content unavailable.</p>'
  }
}

/** Load template body from DB or defaults. */
export async function getTemplateBody(documentType: DocumentTypeKey): Promise<string> {
  const row = await prisma.documentTemplate.findUnique({
    where: { documentType },
  })
  if (row?.contentHtml) return row.contentHtml
  return DEFAULT_TEMPLATE_BODIES[documentType] || ''
}

/** Render full HTML from template + merge vars (or legacy fallback). */
export async function renderDocumentHtml(
  documentType: DocumentTypeKey,
  employee: EmployeeData,
  metadata?: Record<string, unknown> | null,
  options?: DocumentGenerationOptions
): Promise<string> {
  try {
    const bodyTemplate = await getTemplateBody(documentType)
    if (!bodyTemplate) {
      return legacyGenerate(documentType, employee, metadata, options)
    }
    const vars = buildMergeVars(documentType, employee, metadata, options)
    const mergedBody = mergeTemplatePlaceholders(bodyTemplate, vars)
    return buildDocumentHtml(mergedBody, TEMPLATE_EXTRA_STYLES[documentType] || '')
  } catch (err) {
    console.error('Template render failed, using legacy generator:', err)
    return legacyGenerate(documentType, employee, metadata, options)
  }
}

/** Prefer stored contentHtml; otherwise render from template/legacy. */
export async function resolveDocumentHtml(opts: {
  documentType: string
  contentHtml?: string | null
  employee: EmployeeData
  metadata?: Record<string, unknown> | null
  documentUrl?: string | null
  generatedAt?: Date | string | null
}): Promise<string> {
  if (opts.documentType === 'CUSTOM') {
    return opts.documentUrl
      ? `<div style="padding:2rem;text-align:center;"><p>Uploaded document.</p><p><a href="${opts.documentUrl}" target="_blank" rel="noopener noreferrer">Open document</a></p></div>`
      : '<div style="padding:2rem;text-align:center;"><p>No file linked to this document.</p></div>'
  }

  if (opts.contentHtml?.trim()) {
    return opts.contentHtml
  }

  return renderDocumentHtml(
    opts.documentType as DocumentTypeKey,
    opts.employee,
    opts.metadata,
    { generatedAt: opts.generatedAt }
  )
}

/** Rebuild full HTML after TipTap body edit. */
export function wrapEditedBody(bodyHtml: string, documentType?: string): string {
  const extra = documentType ? TEMPLATE_EXTRA_STYLES[documentType] || '' : ''
  const extracted = extractBodyHtml(bodyHtml)
  const body = stripDocumentChrome(extracted)
  return buildDocumentHtml(body, extra)
}

export { DOCUMENT_TEMPLATE_NAMES, DEFAULT_TEMPLATE_BODIES, extractBodyHtml }
export type { DocumentGenerationOptions }
