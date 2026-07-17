// Color mapping for lead statuses
export const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  // New & Hot
  'New': {
    bg: 'bg-green-100 dark:bg-green-950/40',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
  },
  'New Lead': {
    bg: 'bg-green-100 dark:bg-green-950/40',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
  },
  'Hot Lead': {
    bg: 'bg-red-100 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
  },
  'Interested': {
    bg: 'bg-green-100 dark:bg-green-950/40',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
  },
  // Follow-ups
  'Follow-up (1-3)': {
    bg: 'bg-yellow-100 dark:bg-yellow-950/40',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
  'Call Back (SD)': {
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
  },
  'Call Back (T)': {
    bg: 'bg-orange-100 dark:bg-orange-950/40',
    border: 'border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-300',
  },
  'Call Back Next Week': {
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
  },
  'Call Back Next Month': {
    bg: 'bg-yellow-100 dark:bg-yellow-950/40',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
  // Scheduled
  'IPD Schedule': {
    bg: 'bg-purple-100 dark:bg-purple-950/40',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-300',
  },
  // Completed
  'IPD Done': {
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  'Closed': {
    bg: 'bg-green-100 dark:bg-green-950/40',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
  },
  'Call Done': {
    bg: 'bg-teal-100 dark:bg-teal-950/40',
    border: 'border-teal-200 dark:border-teal-800',
    text: 'text-teal-700 dark:text-teal-300',
  },
  'C/W Done': {
    bg: 'bg-teal-100 dark:bg-teal-950/40',
    border: 'border-teal-200 dark:border-teal-800',
    text: 'text-teal-700 dark:text-teal-300',
  },
  // Lost/Inactive
  'Lost': {
    bg: 'bg-gray-100 dark:bg-gray-950/40',
    border: 'border-gray-200 dark:border-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
  },
  'DNP': {
    bg: 'bg-slate-100 dark:bg-slate-950/40',
    border: 'border-slate-200 dark:border-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
  },
  'DNP (1-5, Exhausted)': {
    bg: 'bg-slate-100 dark:bg-slate-950/40',
    border: 'border-slate-200 dark:border-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
  },
  'Junk': {
    bg: 'bg-gray-100 dark:bg-gray-950/40',
    border: 'border-gray-200 dark:border-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
  },
  'Churned': {
    bg: 'bg-stone-100 dark:bg-stone-950/40',
    border: 'border-stone-200 dark:border-stone-800',
    text: 'text-stone-700 dark:text-stone-300',
  },
  'Invalid Number': {
    bg: 'bg-gray-100 dark:bg-gray-950/40',
    border: 'border-gray-200 dark:border-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
  },
  'Fund Issues': {
    bg: 'bg-rose-100 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-800',
    text: 'text-rose-700 dark:text-rose-300',
  },
}

export function getStatusColor(status: string | null | undefined) {
  const normalizedStatus = status || 'New'
  return STATUS_COLORS[normalizedStatus] || {
    bg: 'bg-gray-100 dark:bg-gray-950/40',
    border: 'border-gray-200 dark:border-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
  }
}
