import { normalizeLeadStatus } from '@/lib/pipeline-lead-buckets'

export type StatusColor = {
  backgroundColor: string
  borderColor: string
  textColor: string
}

const STATUS_COLORS: Record<string, StatusColor> = {
  New: {
    backgroundColor: '#67ffbd',
    borderColor: '#67ffbd',
    textColor: '#000000',
  },
  'New Lead': {
    backgroundColor: '#67ffbd',
    borderColor: '#67ffbd',
    textColor: '#000000',
  },
  'Hot Lead': {
    backgroundColor: '#d4edbc',
    borderColor: '#d4edbc',
    textColor: '#11734b',
  },
  Interested: {
    backgroundColor: '#d4edbc',
    borderColor: '#d4edbc',
    textColor: '#11734b',
  },
  'Follow-up': {
    backgroundColor: '#d4edbc',
    borderColor: '#d4edbc',
    textColor: '#11734b',
  },
  'Follow-up 1': {
    backgroundColor: '#d4edbc',
    borderColor: '#d4edbc',
    textColor: '#11734b',
  },
  'Follow-up 2': {
    backgroundColor: '#d4edbc',
    borderColor: '#d4edbc',
    textColor: '#11734b',
  },
  'Follow-up 3': {
    backgroundColor: '#d4edbc',
    borderColor: '#d4edbc',
    textColor: '#11734b',
  },
  'Follow-up 4': {
    backgroundColor: '#d4edbc',
    borderColor: '#d4edbc',
    textColor: '#11734b',
  },
  'Follow-up 5': {
    backgroundColor: '#d4edbc',
    borderColor: '#d4edbc',
    textColor: '#11734b',
  },
  'Follow-up (1-3)': {
    backgroundColor: '#d4edbc',
    borderColor: '#d4edbc',
    textColor: '#11734b',
  },
  'OPD Done': {
    backgroundColor: '#bfe1f6',
    borderColor: '#bfe1f6',
    textColor: '#0a53a8',
  },
  'OPD Schedule': {
    backgroundColor: '#ffe5a0',
    borderColor: '#ffe5a0',
    textColor: '#473821',
  },
  'OPD Scheduled': {
    backgroundColor: '#ffe5a0',
    borderColor: '#ffe5a0',
    textColor: '#473821',
  },
  'IPD Done': {
    backgroundColor: '#11734b',
    borderColor: '#11734b',
    textColor: '#d4edbc',
  },
  'IPD Schedule': {
    backgroundColor: '#11734b',
    borderColor: '#11734b',
    textColor: '#d4edbc',
  },
  'IPD Lost': {
    backgroundColor: '#b10202',
    borderColor: '#b10202',
    textColor: '#ffcfc9',
  },
  'Fund Issues': {
    backgroundColor: '#e6e6e6',
    borderColor: '#e6e6e6',
    textColor: '#3d3d3d',
  },
  DNP: {
    backgroundColor: '#b10202',
    borderColor: '#b10202',
    textColor: '#ffcfc9',
  },
  'DNP-1': {
    backgroundColor: '#b10202',
    borderColor: '#b10202',
    textColor: '#ffcfc9',
  },
  'DNP-2': {
    backgroundColor: '#b10202',
    borderColor: '#b10202',
    textColor: '#ffcfc9',
  },
  'DNP-3': {
    backgroundColor: '#b10202',
    borderColor: '#b10202',
    textColor: '#ffcfc9',
  },
  'DNP-4': {
    backgroundColor: '#b10202',
    borderColor: '#b10202',
    textColor: '#ffcfc9',
  },
  'DNP-5': {
    backgroundColor: '#b10202',
    borderColor: '#b10202',
    textColor: '#ffcfc9',
  },
  'DNP Exhausted': {
    backgroundColor: '#b10202',
    borderColor: '#b10202',
    textColor: '#ffcfc9',
  },
  'DNP (1-5, Exhausted)': {
    backgroundColor: '#b10202',
    borderColor: '#b10202',
    textColor: '#ffcfc9',
  },
  'Call Back (SD)': {
    backgroundColor: '#ffcfc9',
    borderColor: '#ffcfc9',
    textColor: '#b10202',
  },
  'Call Back (T)': {
    backgroundColor: '#ffcfc9',
    borderColor: '#ffcfc9',
    textColor: '#b10202',
  },
  'Call Back Next Week': {
    backgroundColor: '#ffcfc9',
    borderColor: '#ffcfc9',
    textColor: '#b10202',
  },
  'Call Back Next Month': {
    backgroundColor: '#ffcfc9',
    borderColor: '#ffcfc9',
    textColor: '#b10202',
  },
  'Call Done': {
    backgroundColor: '#0028b1',
    borderColor: '#0028b1',
    textColor: '#ffec03',
  },
  'C/W Done': {
    backgroundColor: '#0028b1',
    borderColor: '#0028b1',
    textColor: '#ffec03',
  },
  'WA Done': {
    backgroundColor: '#0028b1',
    borderColor: '#0028b1',
    textColor: '#ffec03',
  },
  'Scan Done': {
    backgroundColor: '#0028b1',
    borderColor: '#0028b1',
    textColor: '#ffec03',
  },
  Closed: {
    backgroundColor: '#3d3d3d',
    borderColor: '#3d3d3d',
    textColor: '#e5e5e5',
  },
  Converted: {
    backgroundColor: '#3d3d3d',
    borderColor: '#3d3d3d',
    textColor: '#e5e5e5',
  },
  'Order Booked': {
    backgroundColor: '#3d3d3d',
    borderColor: '#3d3d3d',
    textColor: '#e5e5e5',
  },
  'Policy Booked': {
    backgroundColor: '#11734b',
    borderColor: '#11734b',
    textColor: '#d4edbc',
  },
  'Policy Issued': {
    backgroundColor: '#11734b',
    borderColor: '#11734b',
    textColor: '#d4edbc',
  },
  'Out of Station': {
    backgroundColor: '#ffe5a0',
    borderColor: '#ffe5a0',
    textColor: '#11734b',
  },
  'Out of Station follow-up': {
    backgroundColor: '#ffe5a0',
    borderColor: '#ffe5a0',
    textColor: '#11734b',
  },
  'Out of station follow-up': {
    backgroundColor: '#ffe5a0',
    borderColor: '#ffe5a0',
    textColor: '#11734b',
  },
  'Supply Gap': {
    backgroundColor: '#ffe5a0',
    borderColor: '#ffe5a0',
    textColor: '#11734b',
  },
  'SX Not Suggested': {
    backgroundColor: '#e6e6e6',
    borderColor: '#e6e6e6',
    textColor: '#3d3d3d',
  },
  'Language Barrier': {
    backgroundColor: '#e6e6e6',
    borderColor: '#e6e6e6',
    textColor: '#3d3d3d',
  },
  Junk: {
    backgroundColor: '#e6e6e6',
    borderColor: '#e6e6e6',
    textColor: '#3d3d3d',
  },
  'Duplicate lead': {
    backgroundColor: '#e6e6e6',
    borderColor: '#e6e6e6',
    textColor: '#3d3d3d',
  },
  'Not Interested': {
    backgroundColor: '#b10202',
    borderColor: '#b10202',
    textColor: '#ffcfc9',
  },
  Nurture: {
    backgroundColor: '#5a3286',
    borderColor: '#5a3286',
    textColor: '#e5cff2',
  },
  'Nurture 1': {
    backgroundColor: '#5a3286',
    borderColor: '#5a3286',
    textColor: '#e5cff2',
  },
  'Nurture 2': {
    backgroundColor: '#5a3286',
    borderColor: '#5a3286',
    textColor: '#e5cff2',
  },
  'Nurture 3': {
    backgroundColor: '#5a3286',
    borderColor: '#5a3286',
    textColor: '#e5cff2',
  },
  'Nurture 4': {
    backgroundColor: '#5a3286',
    borderColor: '#5a3286',
    textColor: '#e5cff2',
  },
  'Nurture 5': {
    backgroundColor: '#5a3286',
    borderColor: '#5a3286',
    textColor: '#e5cff2',
  },
  'Nuture 1': {
    backgroundColor: '#5a3286',
    borderColor: '#5a3286',
    textColor: '#e5cff2',
  },
  'Nuture 2': {
    backgroundColor: '#5a3286',
    borderColor: '#5a3286',
    textColor: '#e5cff2',
  },
  'Nuture 3': {
    backgroundColor: '#5a3286',
    borderColor: '#5a3286',
    textColor: '#e5cff2',
  },
  'Nuture 4': {
    backgroundColor: '#5a3286',
    borderColor: '#5a3286',
    textColor: '#e5cff2',
  },
  'Nuture 5': {
    backgroundColor: '#5a3286',
    borderColor: '#5a3286',
    textColor: '#e5cff2',
  },
  Lost: {
    backgroundColor: '#e6e6e6',
    borderColor: '#e6e6e6',
    textColor: '#3d3d3d',
  },
  Churned: {
    backgroundColor: '#e6e6e6',
    borderColor: '#e6e6e6',
    textColor: '#3d3d3d',
  },
  'Invalid Number': {
    backgroundColor: '#e6e6e6',
    borderColor: '#e6e6e6',
    textColor: '#3d3d3d',
  },
  'Already Insured': {
    backgroundColor: '#b10202',
    borderColor: '#b10202',
    textColor: '#ffcfc9',
  },
}

const DEFAULT_STATUS_COLOR: StatusColor = {
  backgroundColor: '#e6e6e6',
  borderColor: '#e6e6e6',
  textColor: '#3d3d3d',
}

export function getStatusColor(status: string | null | undefined): StatusColor {
  const normalizedStatus = normalizeLeadStatus(status)
  return STATUS_COLORS[normalizedStatus] || DEFAULT_STATUS_COLOR
}
