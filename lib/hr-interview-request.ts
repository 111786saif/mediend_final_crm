import { z } from 'zod'

export const interviewCreateSchema = z.object({
  candidateName: z
    .string({ required_error: 'Candidate name is required' })
    .min(1, 'Candidate name is required')
    .max(200, 'Candidate name is too long'),
  candidateRole: z
    .string({ required_error: 'Role is required' })
    .min(1, 'Role is required')
    .max(200, 'Role is too long'),
  candidatePhone: z
    .string({ required_error: 'Candidate phone is required' })
    .regex(/^\d{10}$/, 'Candidate phone must be exactly 10 digits'),
  departmentId: z.string().optional().nullable().or(z.literal('')),
  interviewRound: z
    .number({ invalid_type_error: 'Round must be a number' })
    .int('Round must be a whole number')
    .min(1, 'Round must be at least 1')
    .max(99, 'Round must be at most 99'),
  type: z.enum(['VIRTUAL', 'OFFLINE'], { required_error: 'Choose walk-in or virtual' }),
  meetLink: z
    .string()
    .url('Meet link must be a valid URL')
    .optional()
    .nullable()
    .or(z.literal('')),
  location: z.string().max(500, 'Location is too long').optional().nullable().or(z.literal('')),
  scheduledAt: z
    .string({ required_error: 'Date & time is required' })
    .transform((s) => new Date(s)),
  endTime: z.string().transform((s) => new Date(s)).optional().nullable(),
  notes: z.string().max(10000, 'Notes are too long').optional().nullable().or(z.literal('')),
  participantUserIds: z.array(z.string()),
  isRecorded: z.boolean().default(false),
  resumeUrl: z.string().url('Resume URL is invalid').optional().nullable().or(z.literal('')),
  /** If empty, title is derived from candidate name and round */
  title: z.string().max(300, 'Title is too long').optional().nullable().or(z.literal('')),
})

export type InterviewCreateInput = z.infer<typeof interviewCreateSchema>

export function interviewTitleFromBody(data: InterviewCreateInput): string {
  const custom = data.title?.trim()
  if (custom) return custom
  return `Interview — ${data.candidateName.trim()} (Round ${data.interviewRound})`
}
