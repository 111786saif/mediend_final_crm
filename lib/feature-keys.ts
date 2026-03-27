export const FEATURE_KEYS = {
  MD_APPROVAL_REQUEST: 'md_approval_request',
  CREATE_NOTICE: 'create_notice',
  WORKLOG_ENFORCEMENT: 'worklog_enforcement',
  CREATE_MEET: 'create_meet',
} as const

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS]
