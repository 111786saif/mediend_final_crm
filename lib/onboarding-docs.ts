export type ExperienceType = 'FRESHER' | 'EXPERIENCED'

export type OnboardingDocKey =
  | 'profilePicture'
  | 'aadharDocUrl'
  | 'panDocUrl'
  | 'resumeDocUrl'
  | 'educationalCertDocUrl'
  | 'appointmentLetterDocUrl'
  | 'salarySlipDocUrl'
  | 'bankStatementDocUrl'

export interface OnboardingDocField {
  key: OnboardingDocKey
  label: string
  /** Stored on User.profilePicture instead of Employee */
  userField?: boolean
}

const FRESHER_DOCS: OnboardingDocField[] = [
  { key: 'aadharDocUrl', label: 'Aadhaar Card' },
  { key: 'panDocUrl', label: 'PAN Card' },
  { key: 'resumeDocUrl', label: 'Resume' },
  { key: 'profilePicture', label: 'Passport Photo', userField: true },
  { key: 'educationalCertDocUrl', label: 'Educational Certificates' },
]

const EXPERIENCED_DOCS: OnboardingDocField[] = [
  ...FRESHER_DOCS,
  { key: 'appointmentLetterDocUrl', label: 'Previous company offer letter' },
  { key: 'salarySlipDocUrl', label: 'Salary slip' },
  { key: 'bankStatementDocUrl', label: 'Bank statement' },
]

export function getOnboardingDocFields(experienceType?: ExperienceType | null): OnboardingDocField[] {
  return experienceType === 'EXPERIENCED' ? EXPERIENCED_DOCS : FRESHER_DOCS
}

export function getOnboardingDocLabels(experienceType?: ExperienceType | null): string[] {
  return getOnboardingDocFields(experienceType).map((d) => d.label)
}
