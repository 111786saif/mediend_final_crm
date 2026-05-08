/**
 * Computes the most recent activity timestamp on a lead by taking the max of
 * all related-table timestamps (KYP, pre-auth, Q&A, initiate form, admission,
 * discharge sheet, PL, stage history, chat) plus the lead's own updatedDate /
 * createdDate.
 *
 * Use this in place of `lead.updatedDate ?? lead.createdDate` to surface cases
 * with recent insurance/BD/chat activity even when the Lead row itself wasn't
 * directly mutated.
 */

type Timestampable = string | Date | null | undefined

interface LeadLike {
  updatedDate?: Timestampable
  createdDate?: Timestampable
  kypSubmission?: {
    updatedAt?: Timestampable
    preAuthData?: {
      updatedAt?: Timestampable
      queries?: { updatedAt?: Timestampable }[]
    } | null
  } | null
  insuranceInitiateForm?: { updatedAt?: Timestampable } | null
  admissionRecord?: {
    ipdStatusUpdatedAt?: Timestampable
    initiatedAt?: Timestampable
  } | null
  dischargeSheet?: { updatedAt?: Timestampable } | null
  plRecord?: { updatedAt?: Timestampable } | null
  caseStageHistory?: { changedAt?: Timestampable }[]
  caseChatMessages?: { createdAt?: Timestampable }[]
}

function ts(value: Timestampable): number {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

export function getLatestActivityTime(lead: LeadLike): number {
  return Math.max(
    ts(lead.updatedDate),
    ts(lead.createdDate),
    ts(lead.kypSubmission?.updatedAt),
    ts(lead.kypSubmission?.preAuthData?.updatedAt),
    ts(lead.kypSubmission?.preAuthData?.queries?.[0]?.updatedAt),
    ts(lead.insuranceInitiateForm?.updatedAt),
    ts(lead.admissionRecord?.ipdStatusUpdatedAt),
    ts(lead.admissionRecord?.initiatedAt),
    ts(lead.dischargeSheet?.updatedAt),
    ts(lead.plRecord?.updatedAt),
    ts(lead.caseStageHistory?.[0]?.changedAt),
    ts(lead.caseChatMessages?.[0]?.createdAt),
  )
}
