import { mapStatusCode } from '@/lib/mysql-code-mappings'
import {
  isOpdDoneStatus,
  isOpdScheduledStatus,
  OPD_DONE_LABEL,
  OPD_SCHEDULED_LABEL,
} from '@/lib/lead-opd-workflow'

export type PipelineStatusBucket =
  | 'all'
  | 'new_hot'
  | 'nurture'
  | 'nurture_1'
  | 'nurture_2'
  | 'nurture_3'
  | 'nurture_4'
  | 'nurture_5'
  | 'follow_up'
  | 'callback'
  | 'opd_done'
  | 'ipd_done'
  | 'opd_sch'
  | 'ipd_sch'
  | 'dnp'
  | 'dnp_exh'
  | 'junk'
  | 'outstation'
  | 'outstation_follow_up'
  | 'duplicate'
  | 'ipd_loss'
  | 'fund_issues'
  | 'lost'
  | 'closed'

const STATUS_NORMALIZE: Record<string, string> = {
  'new lead': 'New Lead',
  new: 'New',
  'hot lead': 'Hot Lead',
  hot: 'Hot Lead',
  interested: 'Interested',
  'follow-up 1': 'Follow-up 1',
  'follow-up 2': 'Follow-up 2',
  'follow-up 3': 'Follow-up 3',
  'follow-up 4': 'Follow-up 4',
  'follow-up 5': 'Follow-up 5',
  'follow-up': 'Follow-up',
  'follow-up (1-3)': 'Follow-up (1-3)',
  'follow up (1-3)': 'Follow-up (1-3)',
  'call back (sd)': 'Call Back (SD)',
  'call back (t)': 'Call Back (T)',
  'call back next week': 'Call Back Next Week',
  'call back next month': 'Call Back Next Month',
  'ipd schedule': 'IPD Schedule',
  opd_scheduled: OPD_SCHEDULED_LABEL,
  'opd scheduled': OPD_SCHEDULED_LABEL,
  'opd done': OPD_DONE_LABEL,
  opd_done: OPD_DONE_LABEL,
  'ipd done': 'IPD Done',
  closed: 'Closed',
  'call done': 'Call Done',
  'c/w done': 'C/W Done',
  'wa done': 'C/W Done',
  'scan done': 'C/W Done',
  lost: 'Lost',
  'ipd lost': 'IPD Lost',
  'dnp-1': 'DNP-1',
  'dnp-2': 'DNP-2',
  'dnp-3': 'DNP-3',
  'dnp-4': 'DNP-4',
  'dnp-5': 'DNP-5',
  dnp: 'DNP',
  'dnp exhausted': 'DNP Exhausted',
  'dnp (1-5, exhausted)': 'DNP (1-5, Exhausted)',
  junk: 'Junk',
  churned: 'Lost',
  'invalid number': 'Invalid Number',
  'fund issues': 'Fund Issues',
  'not interested': 'Not Interested',
  'duplicate lead': 'Duplicate lead',
  nurture: 'Nurture',
  'nurture 1': 'Nurture 1',
  'nurture 2': 'Nurture 2',
  'nurture 3': 'Nurture 3',
  'nurture 4': 'Nurture 4',
  'nurture 5': 'Nurture 5',
  'nuture 1': 'Nuture 1',
  'nuture 2': 'Nuture 2',
  'nuture 3': 'Nuture 3',
  'nuture 4': 'Nuture 4',
  'nuture 5': 'Nuture 5',
  'out of station': 'Out of Station',
  'out of station follow-up': 'Out of Station follow-up',
  'out of station follow up': 'Out of Station follow-up',
  'out of station followup': 'Out of Station follow-up',
  'supply gap': 'Supply Gap',
  'sx not suggested': 'SX Not Suggested',
  'language barrier': 'Language Barrier',
  'fund issued': 'Fund Issued',
  'policy issued': 'Policy Issued',
  'policy booked': 'Policy Booked',
  'order booked': 'Order Booked',
}

export function normalizeLeadStatus(status: string | null | undefined): string {
  if (!status) return ''
  if (isOpdScheduledStatus(status)) return OPD_SCHEDULED_LABEL
  if (isOpdDoneStatus(status)) return OPD_DONE_LABEL
  const mapped = mapStatusCode(status)
  const normalized = mapped.trim().toLowerCase()
  return STATUS_NORMALIZE[normalized] || mapped
}

export function getLeadPipelineBucket(status: string | null | undefined): Exclude<PipelineStatusBucket, 'all'> {
  const s = normalizeLeadStatus(status)
  const lower = s.toLowerCase()

  // 1. OPD Done
  if (s === OPD_DONE_LABEL || lower.includes('opd done') || s === '11') {
    return 'opd_done'
  }
  // 2. IPD Done
  if (s === 'IPD Done' || lower.includes('ipd done') || s === '13') {
    return 'ipd_done'
  }
  // 3. IPD Schedule
  if (s === 'IPD Schedule' || lower.includes('ipd schedule') || s === '14') {
    return 'ipd_sch'
  }
  // 4. OPD Schedule
  if (isOpdScheduledStatus(status) || s === 'OPD Schedule' || s === '12') {
    return 'opd_sch'
  }
  // 5. Callback: ONLY Callback
  if (
    ['Call Back (SD)', 'Call Back (T)', 'Call Back Next Week', 'Call Back Next Month'].includes(s) ||
    lower.includes('call back') ||
    lower.includes('callback') ||
    ['19', '20', '21', '22'].includes(s)
  ) {
    return 'callback'
  }
  // 6. Follow-up: ONLY Follow-up
  if (
    [
      'Follow-up 1',
      'Follow-up 2',
      'Follow-up 3',
      'Follow-up',
      'Followup',
    ].includes(s) ||
    ['1', '2', '3', '35'].includes(s)
  ) {
    return 'follow_up'
  }
  // 7. Fund Issues: ONLY Fund Issues
  if (
    ['Fund Issues', 'Fund Issue'].includes(s) ||
    lower.includes('fund issue') ||
    lower.includes('fund issues') ||
    s === '10'
  ) {
    return 'fund_issues'
  }
  // 8. Nurture levels are individually selectable in Churning Data.
  for (const level of [1, 2, 3, 4, 5] as const) {
    if (
      s === `Nurture ${level}` ||
      s === `Nuture ${level}` ||
      s === `Nurture${level}` ||
      s === `Nurture-${level}` ||
      lower === `nurture ${level}` ||
      lower === `nuture ${level}` ||
      lower === `nurture${level}` ||
      lower === `nurture-${level}` ||
      lower === `nuture-${level}`
    ) {
      return `nurture_${level}` as Exclude<PipelineStatusBucket, 'all'>
    }
  }
  // 9. Nurture: unnumbered Nurture only.
  if (
    s === 'Nurture' || lower === 'nurture' ||
    s === '37'
  ) {
    return 'nurture'
  }
  // 9. New Lead (ONLY New Lead — excluding null, empty, Hot Lead, Interested)
  if (
    [
      'New',
      'New Lead',
    ].includes(s) ||
    lower === 'new' ||
    lower === 'new lead' ||
    s === '27'
  ) {
    return 'new_hot'
  }
  // 10. Junk (ONLY Junk)
  if (s === 'Junk' || lower === 'junk' || s === '26') {
    return 'junk'
  }
  // 11. Out of Station follow-up has its own irrelevant-lead bucket.
  if (
    lower.includes('out of station follow') ||
    lower.includes('out of station followup') ||
    s === '42'
  ) {
    return 'outstation_follow_up'
  }
  // 12. Out of Station (ONLY Out of station)
  if (
    s === 'Out of Station' ||
    lower.includes('out of station') ||
    s === '16'
  ) {
    return 'outstation'
  }
  // 12. Duplicate (ONLY Duplicate)
  if (
    ['Duplicate lead', 'Duplicate Lead', 'Duplicate'].includes(s) ||
    lower.includes('duplicate') ||
    s === '34'
  ) {
    return 'duplicate'
  }
  // 13. IPD Lost (ONLY IPD Lost)
  if (s === 'IPD Lost' || lower.includes('ipd lost') || s === '15') {
    return 'ipd_loss'
  }
  // 14. DNP Exhausted (ONLY DNP Exhausted)
  if (['DNP Exhausted', 'DNP (1-5, Exhausted)'].includes(s) || lower.includes('exhausted') || s === '9') {
    return 'dnp_exh'
  }
  // 15. DNP: all other DNP
  if (
    ['DNP', 'DNP-1', 'DNP-2', 'DNP-3', 'DNP-4', 'DNP-5'].includes(s) ||
    lower.includes('dnp') ||
    lower.includes('did not pick') ||
    lower.includes('not connected') ||
    ['4', '5', '6', '7', '8'].includes(s)
  ) {
    return 'dnp'
  }
  // 16. Closed / Won (ONLY Closed)
  if (
    s === 'Closed' ||
    lower === 'closed' ||
    s === '25'
  ) {
    return 'closed'
  }
  // 17. Lost / Inactive
  if (
    ['Lost', 'Churned', 'Not Interested', 'Already Insured', 'SX Not Suggested', 'Language Barrier', 'Invalid Number', 'Supply Gap'].includes(s) ||
    lower.includes('lost') ||
    lower.includes('churn') ||
    lower.includes('not interested') ||
    lower.includes('language barrier') ||
    lower.includes('invalid') ||
    lower.includes('supply gap') ||
    lower.includes('sx not suggested') ||
    ['17', '18', '23', '33', '36', '41'].includes(s)
  ) {
    return 'lost'
  }
  return 'nurture'
}

export const PIPELINE_BUCKET_LABELS: Record<Exclude<PipelineStatusBucket, 'all'>, string> = {
  new_hot: 'New Lead',
  nurture: 'Nurture',
  nurture_1: 'Nurture 1',
  nurture_2: 'Nurture 2',
  nurture_3: 'Nurture 3',
  nurture_4: 'Nurture 4',
  nurture_5: 'Nurture 5',
  follow_up: 'Follow-up',
  callback: 'Callback',
  opd_done: 'OPD Done',
  ipd_done: 'IPD Done',
  opd_sch: 'OPD Scheduled',
  ipd_sch: 'IPD Scheduled',
  dnp: 'DNP',
  dnp_exh: 'DNP Exhausted',
  junk: 'Junk',
  outstation: 'Out of Station',
  outstation_follow_up: 'Out of Station follow-up',
  duplicate: 'Duplicate',
  ipd_loss: 'IPD Lost',
  fund_issues: 'Fund Issues',
  lost: 'Lost / Inactive',
  closed: 'Closed / Won',
}

export function countBuckets(leads: { status?: string | null }[]) {
  const counts: Record<Exclude<PipelineStatusBucket, 'all'>, number> = {
    new_hot: 0,
    nurture: 0,
    nurture_1: 0,
    nurture_2: 0,
    nurture_3: 0,
    nurture_4: 0,
    nurture_5: 0,
    follow_up: 0,
    callback: 0,
    opd_done: 0,
    ipd_done: 0,
    opd_sch: 0,
    ipd_sch: 0,
    dnp: 0,
    dnp_exh: 0,
    junk: 0,
    outstation: 0,
    outstation_follow_up: 0,
    duplicate: 0,
    ipd_loss: 0,
    fund_issues: 0,
    lost: 0,
    closed: 0,
  }
  for (const lead of leads) {
    counts[getLeadPipelineBucket(lead.status)]++
  }
  return counts
}

export type LeadAgeFilter = 'all' | 'new' | 'lt1m' | '1to2m' | '2to3m' | '3plus'

export function getLeadReceiptDate(lead: { leadEntryDate?: string | Date | null; createdDate?: string | Date | null }): Date | null {
  const raw = lead.leadEntryDate ?? lead.createdDate
  if (!raw) return null
  const d = typeof raw === 'string' ? new Date(raw) : raw
  return Number.isNaN(d.getTime()) ? null : d
}

function leadAgeBucket(lead: { leadEntryDate?: string | Date | null; createdDate?: string | Date | null }): LeadAgeFilter {
  const d = getLeadReceiptDate(lead)
  if (!d) return 'all'
  const now = new Date()
  const days = (now.getTime() - d.getTime()) / (86400 * 1000)
  if (days < 7) return 'new'
  if (days < 30) return 'lt1m'
  if (days < 60) return '1to2m'
  if (days < 90) return '2to3m'
  return '3plus'
}

/** Label + tailwind classes for badge */
export function getLeadAgeInfo(lead: { leadEntryDate?: string | Date | null; createdDate?: string | Date | null }): {
  label: string
  filter: LeadAgeFilter
  className: string
} {
  const d = getLeadReceiptDate(lead)
  if (!d) {
    return { label: 'Unknown', filter: 'all', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' }
  }
  const b = leadAgeBucket(lead)
  if (b === 'new') {
    return { label: 'New', filter: 'new', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' }
  }
  if (b === 'lt1m') {
    return { label: '< 1 month', filter: 'lt1m', className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' }
  }
  if (b === '1to2m') {
    return { label: '1 month', filter: '1to2m', className: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' }
  }
  if (b === '2to3m') {
    return { label: '2 months', filter: '2to3m', className: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200' }
  }
  return { label: '3+ months', filter: '3plus', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' }
}

export function matchesLeadAgeFilter(
  lead: { leadEntryDate?: string | Date | null; createdDate?: string | Date | null },
  filter: LeadAgeFilter
): boolean {
  if (filter === 'all') return true
  return leadAgeBucket(lead) === filter
}
