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
  | 'follow_up'
  | 'ipd_done'
  | 'dnp'
  | 'junk'
  | 'lost'
  | 'closed'

const STATUS_NORMALIZE: Record<string, string> = {
  'new lead': 'New',
  new: 'New',
  'hot lead': 'Hot Lead',
  hot: 'Hot Lead',
  interested: 'Interested',
  'follow-up 1': 'Follow-up (1-3)',
  'follow-up 2': 'Follow-up (1-3)',
  'follow-up 3': 'Follow-up (1-3)',
  'follow-up': 'Follow-up (1-3)',
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
  'ipd lost': 'Lost',
  'dnp-1': 'DNP',
  'dnp-2': 'DNP',
  'dnp-3': 'DNP',
  'dnp-4': 'DNP',
  'dnp-5': 'DNP',
  dnp: 'DNP',
  'dnp exhausted': 'DNP (1-5, Exhausted)',
  'dnp (1-5, exhausted)': 'DNP (1-5, Exhausted)',
  junk: 'Junk',
  churned: 'Lost',
  'invalid number': 'Invalid Number',
  'fund issues': 'Fund Issues',
  'not interested': 'Lost',
  'duplicate lead': 'Lost',
}

export function normalizeLeadStatus(status: string | null | undefined): string {
  if (!status) return 'New'
  if (isOpdScheduledStatus(status)) return OPD_SCHEDULED_LABEL
  if (isOpdDoneStatus(status)) return OPD_DONE_LABEL
  const mapped = mapStatusCode(status)
  const normalized = mapped.trim().toLowerCase()
  return STATUS_NORMALIZE[normalized] || mapped
}

export function getLeadPipelineBucket(status: string | null | undefined): Exclude<PipelineStatusBucket, 'all'> {
  const s = normalizeLeadStatus(status)
  const lower = s.toLowerCase()

  if (['New', 'New Lead', 'Hot Lead', 'Interested', 'Nurture'].includes(s) || lower.includes('new') || lower.includes('hot') || lower.includes('interested')) {
    return 'new_hot'
  }
  if (s === 'Junk' || s === 'Invalid Number' || lower.includes('junk') || lower.includes('invalid number')) {
    return 'junk'
  }
  if (
    [
      'Follow-up (1-3)',
      'Follow-up 1',
      'Follow-up 2',
      'Follow-up 3',
      'Follow-up',
      'Call Back (SD)',
      'Call Back (T)',
      'Call Back Next Week',
      'Call Back Next Month',
      'Out of Station',
      'Out of station follow-up',
      'IPD Schedule',
      OPD_SCHEDULED_LABEL,
      OPD_DONE_LABEL,
      'OPD Schedule',
    ].includes(s) ||
    lower.includes('follow') ||
    lower.includes('call back') ||
    (lower.includes('schedule') && !lower.includes('ipd done'))
  ) {
    return 'follow_up'
  }
  if (s === 'IPD Done' || lower.includes('ipd done')) {
    return 'ipd_done'
  }
  if (['DNP', 'DNP-1', 'DNP-2', 'DNP-3', 'DNP-4', 'DNP-5', 'DNP Exhausted', 'DNP (1-5, Exhausted)'].includes(s) || lower.includes('dnp')) {
    return 'dnp'
  }
  if (
    ['Closed', 'Call Done', 'C/W Done', 'WA Done', 'Scan Done', 'Order Booked', 'Policy Booked', 'Policy Issued'].includes(s) ||
    lower.includes('closed') ||
    (lower.includes('done') && !lower.includes('ipd')) ||
    lower.includes('booked')
  ) {
    return 'closed'
  }
  if (
    ['Lost', 'Churned', 'IPD Lost', 'Fund Issues', 'Not Interested', 'Duplicate lead', 'Already Insured', 'SX Not Suggested', 'Language Barrier'].includes(s) ||
    lower.includes('lost') ||
    lower.includes('churn') ||
    lower.includes('duplicate') ||
    lower.includes('not interested') ||
    lower.includes('fund issues') ||
    lower.includes('language barrier')
  ) {
    return 'lost'
  }
  return 'follow_up'
}

export const PIPELINE_BUCKET_LABELS: Record<Exclude<PipelineStatusBucket, 'all'>, string> = {
  new_hot: 'New / Hot',
  follow_up: 'Follow-up',
  ipd_done: 'IPD Done',
  dnp: 'DNP',
  junk: 'Junk / Invalid',
  lost: 'Lost / Inactive',
  closed: 'Closed / Won',
}

export function countBuckets(leads: { status?: string | null }[]) {
  const counts: Record<Exclude<PipelineStatusBucket, 'all'>, number> = {
    new_hot: 0,
    follow_up: 0,
    ipd_done: 0,
    dnp: 0,
    junk: 0,
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
