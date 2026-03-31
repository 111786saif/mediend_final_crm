import { z } from 'zod'

export const interviewCreateSchema = z.object({
  candidateName: z.string().min(1).max(200),
  candidateRole: z.string().min(1).max(200),
  candidatePhone: z
    .string()
    .regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
  departmentId: z.string().optional().nullable().or(z.literal('')),
  interviewRound: z.number().int().min(1).max(99),
  type: z.enum(['VIRTUAL', 'OFFLINE']),
  meetLink: z.string().url().optional().nullable().or(z.literal('')),
  location: z.string().max(500).optional().nullable().or(z.literal('')),
  scheduledAt: z.string().transform((s) => new Date(s)),
  endTime: z.string().transform((s) => new Date(s)).optional().nullable(),
  notes: z.string().max(10000).optional().nullable().or(z.literal('')),
  participantUserIds: z.array(z.string()),
  isRecorded: z.boolean().default(false),
  resumeUrl: z.string().url().optional().nullable().or(z.literal('')),
  /** If empty, title is derived from candidate name and round */
  title: z.string().max(300).optional().nullable().or(z.literal('')),
})

export type InterviewCreateInput = z.infer<typeof interviewCreateSchema>

export function interviewTitleFromBody(data: InterviewCreateInput): string {
  const custom = data.title?.trim()
  if (custom) return custom
  return `Interview — ${data.candidateName.trim()} (Round ${data.interviewRound})`
}
