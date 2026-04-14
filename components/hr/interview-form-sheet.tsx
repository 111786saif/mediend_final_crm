'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import type { InterviewMeet } from '@/components/hr/interview-list'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Users, Upload, Video, MapPin, CalendarClock, History, Clock } from 'lucide-react'
import { isValid } from 'date-fns'
import { DateTimePicker } from '@/components/ui/date-time-picker'

type InterviewFieldError = Partial<
  Record<
    | 'candidateName'
    | 'candidatePhone'
    | 'candidateRole'
    | 'scheduledAt'
    | 'location'
    | 'meetLink'
    | 'interviewRound'
    | 'duration',
    string
  >
>

const INTERVIEW_DURATION_PRESETS: { label: string; minutes: number }[] = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
]

function isKnownInterviewField(f: string): f is keyof InterviewFieldError {
  return [
    'candidateName',
    'candidatePhone',
    'candidateRole',
    'scheduledAt',
    'location',
    'meetLink',
    'interviewRound',
    'duration',
  ].includes(f)
}

function FieldErrorMsg({ message }: { message: string }) {
  return (
    <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400" role="alert">
      {message}
    </p>
  )
}

const ROLE_PRESETS = [
  'Software Engineer',
  'HR Executive',
  'BD / Sales',
  'Team Lead',
  'Finance Analyst',
  'Operations',
  'Nurse / Clinical',
  'Admin',
  'Intern',
  'Other (type below)',
]

type EmployeeRow = {
  id: string
  user: { id: string; name: string; email: string; role: string }
  department: { id: string; name: string } | null
}

type DepartmentRow = { id: string; name: string }

interface InterviewFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set while opening, form loads this interview for editing */
  meetToEdit?: InterviewMeet | null
}

export function InterviewFormSheet({
  open,
  onOpenChange,
  meetToEdit = null,
}: InterviewFormSheetProps) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'schedule' | 'record'>('schedule')
  const [meetType, setMeetType] = useState<'VIRTUAL' | 'OFFLINE'>('OFFLINE')
  const [candidateName, setCandidateName] = useState('')
  const [candidatePhone, setCandidatePhone] = useState('')
  const [rolePreset, setRolePreset] = useState<string>(ROLE_PRESETS[0])
  const [roleCustom, setRoleCustom] = useState('')
  const [departmentId, setDepartmentId] = useState<string>('')
  const [round, setRound] = useState(1)
  const [meetLink, setMeetLink] = useState('')
  const [location, setLocation] = useState('')
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined)
  const [notes, setNotes] = useState('')
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set())
  const [empSearch, setEmpSearch] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeUrl, setResumeUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [displayTitle, setDisplayTitle] = useState('')
  const [durationMins, setDurationMins] = useState<number | null>(null)
  const [customDuration, setCustomDuration] = useState('')
  const [showCustomDuration, setShowCustomDuration] = useState(false)
  const [errors, setErrors] = useState<InterviewFieldError>({})

  const isEdit = Boolean(meetToEdit?.id)

  const { data: departments = [] } = useQuery<DepartmentRow[]>({
    queryKey: ['departments'],
    queryFn: () => apiGet<DepartmentRow[]>('/api/departments'),
    enabled: open,
  })

  const { data: employees = [] } = useQuery<EmployeeRow[]>({
    queryKey: ['employees', 'interview-form'],
    queryFn: () => apiGet<EmployeeRow[]>('/api/employees?status=ACTIVE'),
    enabled: open,
  })

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase()
    if (!q) return employees.slice(0, 80)
    return employees
      .filter(
        (e) =>
          e.user.name.toLowerCase().includes(q) ||
          e.user.email.toLowerCase().includes(q)
      )
      .slice(0, 50)
  }, [employees, empSearch])

  const resolvedRole =
    rolePreset === 'Other (type below)' ? roleCustom.trim() : rolePreset

  const resetForm = useCallback(() => {
    setMode('schedule')
    setMeetType('OFFLINE')
    setCandidateName('')
    setCandidatePhone('')
    setRolePreset(ROLE_PRESETS[0])
    setRoleCustom('')
    setDepartmentId('')
    setRound(1)
    setMeetLink('')
    setLocation('')
    setScheduledAt(undefined)
    setNotes('')
    setParticipantIds(new Set())
    setEmpSearch('')
    setResumeFile(null)
    setResumeUrl(null)
    setDisplayTitle('')
    setDurationMins(null)
    setCustomDuration('')
    setShowCustomDuration(false)
    setErrors({})
  }, [])

  const clearFieldError = useCallback((field: keyof InterviewFieldError) => {
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  useEffect(() => {
    if (!open) return
    if (meetToEdit) {
      setMode(meetToEdit.isRecorded ? 'record' : 'schedule')
      setMeetType(meetToEdit.type)
      setCandidateName(meetToEdit.candidateName || '')
      setCandidatePhone(
        meetToEdit.candidatePhone?.replace(/\D/g, '').slice(0, 10) || ''
      )
      const role = meetToEdit.candidateRole || ''
      if (ROLE_PRESETS.includes(role)) {
        setRolePreset(role)
        setRoleCustom('')
      } else {
        setRolePreset('Other (type below)')
        setRoleCustom(role)
      }
      setDepartmentId(meetToEdit.department?.id || '')
      setRound(meetToEdit.interviewRound ?? 1)
      setMeetLink(meetToEdit.meetLink || '')
      setLocation(meetToEdit.location || '')
      setScheduledAt(
        meetToEdit.scheduledAt ? new Date(meetToEdit.scheduledAt) : undefined
      )
      if (meetToEdit.endTime && meetToEdit.scheduledAt) {
        const mins = Math.round(
          (new Date(meetToEdit.endTime).getTime() -
            new Date(meetToEdit.scheduledAt).getTime()) /
            60_000
        )
        const preset = INTERVIEW_DURATION_PRESETS.find((p) => p.minutes === mins)
        if (preset) {
          setDurationMins(preset.minutes)
          setShowCustomDuration(false)
        } else if (mins > 0) {
          setShowCustomDuration(true)
          setCustomDuration(String(mins))
        }
      } else {
        setDurationMins(null)
        setShowCustomDuration(false)
        setCustomDuration('')
      }
      setErrors({})
      setNotes(meetToEdit.notes || '')
      setParticipantIds(new Set(meetToEdit.participants.map((p) => p.user.id)))
      setResumeFile(null)
      setResumeUrl(meetToEdit.resumeUrl)
      setDisplayTitle(meetToEdit.title || '')
      setEmpSearch('')
    } else {
      resetForm()
    }
  }, [open, meetToEdit, resetForm])

  const effectiveDuration: number | null = useMemo(() => {
    if (showCustomDuration) {
      const n = parseInt(customDuration, 10)
      if (!Number.isFinite(n) || n < 5 || n > 480) return null
      return n
    }
    return durationMins
  }, [showCustomDuration, customDuration, durationMins])

  const validateInterview = (): InterviewFieldError => {
    const e: InterviewFieldError = {}
    if (!candidateName.trim()) e.candidateName = 'Candidate name is required'
    const phoneDigits = candidatePhone.replace(/\D/g, '')
    if (phoneDigits.length !== 10) {
      e.candidatePhone = 'Phone must be exactly 10 digits'
    }
    if (!resolvedRole) e.candidateRole = 'Role is required'
    if (!scheduledAt || !isValid(scheduledAt)) e.scheduledAt = 'Date & time is required'
    if (meetType === 'OFFLINE' && !location.trim()) {
      e.location = 'Location is required for walk-in interviews'
    }
    if (meetType === 'VIRTUAL' && meetLink.trim() && !/^https?:\/\//i.test(meetLink.trim())) {
      e.meetLink = 'Link must start with http:// or https://'
    }
    if (!Number.isFinite(round) || round < 1 || round > 99) {
      e.interviewRound = 'Round must be between 1 and 99'
    }
    if (showCustomDuration) {
      const n = parseInt(customDuration, 10)
      if (!customDuration.trim()) {
        e.duration = 'Enter duration in minutes'
      } else if (!Number.isFinite(n) || n < 5 || n > 480) {
        e.duration = 'Duration must be between 5 and 480 minutes'
      }
    }
    return e
  }

  const scrollErrorIntoView = (first: keyof InterviewFieldError) => {
    const id = `interview-field-${first}`
    if (typeof document !== 'undefined') {
      const el = document.getElementById(id)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }

  const buildInterviewPayload = async () => {
    let finalResumeUrl = resumeUrl
    if (resumeFile) {
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('file', resumeFile)
        const res = await apiPost<{ url: string }>('/api/upload/resume', fd)
        finalResumeUrl = res.url
        setResumeUrl(res.url)
      } finally {
        setUploading(false)
      }
    }

    const start = scheduledAt as Date
    const endIso =
      effectiveDuration != null
        ? new Date(start.getTime() + effectiveDuration * 60_000).toISOString()
        : null

    return {
      candidateName: candidateName.trim(),
      candidateRole: resolvedRole,
      departmentId: departmentId || null,
      interviewRound: round,
      type: meetType,
      meetLink: meetType === 'VIRTUAL' ? meetLink.trim() || null : null,
      location: meetType === 'OFFLINE' ? location.trim() : null,
      scheduledAt: start.toISOString(),
      endTime: endIso,
      notes: notes.trim() || null,
      participantUserIds: Array.from(participantIds),
      isRecorded: mode === 'record',
      resumeUrl: finalResumeUrl || null,
      title: displayTitle.trim() || null,
    }
  }

  const handleServerError = (e: Error & { field?: string }) => {
    if (e.field && isKnownInterviewField(e.field)) {
      setErrors((prev) => ({ ...prev, [e.field as keyof InterviewFieldError]: e.message }))
      scrollErrorIntoView(e.field as keyof InterviewFieldError)
      toast.error(e.message)
    } else {
      toast.error(e.message || 'Failed to save')
    }
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = await buildInterviewPayload()
      return apiPost('/api/hr/interviews', body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-interviews'] })
      queryClient.invalidateQueries({ queryKey: ['meets'] })
      toast.success(mode === 'record' ? 'Interview recorded' : 'Interview scheduled')
      onOpenChange(false)
      resetForm()
    },
    onError: (e: Error) => handleServerError(e as Error & { field?: string }),
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!meetToEdit?.id) throw new Error('Missing interview')
      const body = await buildInterviewPayload()
      return apiPatch(`/api/hr/interviews/${meetToEdit.id}`, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-interviews'] })
      queryClient.invalidateQueries({ queryKey: ['meets'] })
      toast.success('Interview updated')
      onOpenChange(false)
      resetForm()
    },
    onError: (e: Error) => handleServerError(e as Error & { field?: string }),
  })

  const submit = () => {
    const v = validateInterview()
    if (Object.keys(v).length > 0) {
      setErrors(v)
      const first = Object.keys(v)[0] as keyof InterviewFieldError
      scrollErrorIntoView(first)
      return
    }
    setErrors({})
    if (isEdit) updateMutation.mutate()
    else createMutation.mutate()
  }

  function toggleParticipant(userId: string) {
    setParticipantIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-2xl border-t-2 border-violet-400/40 p-0 sm:max-w-lg sm:mx-auto"
      >
        <SheetHeader className="border-b bg-gradient-to-r from-violet-600/10 via-fuchsia-500/10 to-amber-500/10 px-3 py-3 md:p-4">
          <SheetTitle className="text-lg flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-violet-600" />
            {isEdit ? 'Edit interview' : 'Schedule or record interview'}
          </SheetTitle>
          <SheetDescription className="text-left text-xs md:text-sm">
            {isEdit
              ? 'Update time, panel, resume, title, and other details.'
              : 'Add walk-in or virtual interviews. Invite teammates as panelists.'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-3 py-3 md:px-4 md:py-4">
          {!isEdit && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('schedule')}
                className={cn(
                  'flex-1 rounded-xl border-2 py-2.5 text-sm font-semibold transition-all',
                  mode === 'schedule'
                    ? 'border-violet-500 bg-violet-600 text-white shadow-md'
                    : 'border-border bg-card text-muted-foreground'
                )}
              >
                Schedule
              </button>
              <button
                type="button"
                onClick={() => setMode('record')}
                className={cn(
                  'flex-1 rounded-xl border-2 py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-1',
                  mode === 'record'
                    ? 'border-amber-500 bg-amber-500 text-white shadow-md'
                    : 'border-border bg-card text-muted-foreground'
                )}
              >
                <History className="h-4 w-4" />
                Record past
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMeetType('OFFLINE')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-sm font-medium',
                meetType === 'OFFLINE'
                  ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-100'
                  : 'border-border bg-muted/30'
              )}
            >
              <MapPin className="h-4 w-4" />
              Walk-in
            </button>
            <button
              type="button"
              onClick={() => setMeetType('VIRTUAL')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-sm font-medium',
                meetType === 'VIRTUAL'
                  ? 'border-indigo-500 bg-indigo-500/15 text-indigo-900 dark:text-indigo-100'
                  : 'border-border bg-muted/30'
              )}
            >
              <Video className="h-4 w-4" />
              Virtual
            </button>
          </div>

          {meetType === 'VIRTUAL' && (
            <div className="space-y-1.5" id="interview-field-meetLink">
              <Label>Google Meet / video link</Label>
              <Input
                value={meetLink}
                onChange={(e) => {
                  setMeetLink(e.target.value)
                  if (errors.meetLink) clearFieldError('meetLink')
                }}
                placeholder="https://meet.google.com/..."
                aria-invalid={!!errors.meetLink}
                className={cn(
                  'rounded-xl',
                  errors.meetLink && 'border-rose-400 focus-visible:ring-rose-300'
                )}
              />
              {errors.meetLink && <FieldErrorMsg message={errors.meetLink} />}
            </div>
          )}

          {meetType === 'OFFLINE' && (
            <div className="space-y-1.5" id="interview-field-location">
              <Label>
                Location <span className="text-destructive">*</span>
              </Label>
              <Input
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value)
                  if (errors.location) clearFieldError('location')
                }}
                placeholder="Office / floor / room"
                aria-invalid={!!errors.location}
                className={cn(
                  'rounded-xl',
                  errors.location && 'border-rose-400 focus-visible:ring-rose-300'
                )}
              />
              {errors.location && <FieldErrorMsg message={errors.location} />}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Interview title</Label>
            <Input
              value={displayTitle}
              onChange={(e) => setDisplayTitle(e.target.value)}
              placeholder={
                isEdit
                  ? 'Shown in calendar and lists'
                  : 'Optional — defaults to “Interview — Name (Round N)”'
              }
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-2">
            <div className="space-y-1.5" id="interview-field-interviewRound">
              <Label>Round</Label>
              <Input
                type="number"
                min={1}
                max={99}
                value={round}
                onChange={(e) => {
                  setRound(parseInt(e.target.value, 10) || 1)
                  if (errors.interviewRound) clearFieldError('interviewRound')
                }}
                aria-invalid={!!errors.interviewRound}
                className={cn(
                  'rounded-xl',
                  errors.interviewRound && 'border-rose-400 focus-visible:ring-rose-300'
                )}
              />
              {errors.interviewRound && <FieldErrorMsg message={errors.interviewRound} />}
            </div>
            <div className="space-y-1.5 sm:col-span-2" id="interview-field-scheduledAt">
              <Label id="interview-when-label">
                When <span className="text-destructive">*</span>
              </Label>
              <DateTimePicker
                nested
                value={scheduledAt}
                onChange={(d) => {
                  setScheduledAt(d)
                  if (errors.scheduledAt) clearFieldError('scheduledAt')
                }}
                aria-labelledby="interview-when-label"
                className={cn(
                  'rounded-xl min-h-11 h-auto py-2.5',
                  errors.scheduledAt && 'border-rose-400 ring-1 ring-rose-300'
                )}
              />
              {errors.scheduledAt && <FieldErrorMsg message={errors.scheduledAt} />}
            </div>
          </div>

          <div className="space-y-1.5" id="interview-field-duration">
            <Label className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Duration (optional)
            </Label>
            <div className="flex flex-wrap gap-2">
              {INTERVIEW_DURATION_PRESETS.map((p) => {
                const active = !showCustomDuration && durationMins === p.minutes
                return (
                  <button
                    key={p.minutes}
                    type="button"
                    onClick={() => {
                      setDurationMins(p.minutes)
                      setShowCustomDuration(false)
                      if (errors.duration) clearFieldError('duration')
                    }}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-sm font-medium touch-manipulation transition-colors',
                      active
                        ? 'border-violet-500 bg-violet-600 text-white'
                        : 'border-border bg-muted/40 text-foreground active:bg-muted'
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => {
                  setShowCustomDuration(true)
                  setDurationMins(null)
                }}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-sm font-medium touch-manipulation transition-colors',
                  showCustomDuration
                    ? 'border-violet-500 bg-violet-600 text-white'
                    : 'border-border bg-muted/40 text-foreground active:bg-muted'
                )}
              >
                Custom
              </button>
            </div>
            {showCustomDuration && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={5}
                  max={480}
                  value={customDuration}
                  onChange={(e) => {
                    setCustomDuration(e.target.value)
                    if (errors.duration) clearFieldError('duration')
                  }}
                  placeholder="Minutes (5–480)"
                  className="rounded-xl h-10 max-w-[180px]"
                  aria-invalid={!!errors.duration}
                />
                <span className="text-xs text-muted-foreground">minutes</span>
              </div>
            )}
            {errors.duration && <FieldErrorMsg message={errors.duration} />}
          </div>

          <div className="space-y-1.5" id="interview-field-candidateName">
            <Label>
              Candidate name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={candidateName}
              onChange={(e) => {
                setCandidateName(e.target.value)
                if (errors.candidateName) clearFieldError('candidateName')
              }}
              placeholder="Full name"
              aria-invalid={!!errors.candidateName}
              className={cn(
                'rounded-xl',
                errors.candidateName && 'border-rose-400 focus-visible:ring-rose-300'
              )}
            />
            {errors.candidateName && <FieldErrorMsg message={errors.candidateName} />}
          </div>

          <div className="space-y-1.5" id="interview-field-candidatePhone">
            <Label>
              Candidate phone <span className="text-destructive">*</span>
            </Label>
            <Input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              value={candidatePhone}
              onChange={(e) => {
                setCandidatePhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                if (errors.candidatePhone) clearFieldError('candidatePhone')
              }}
              placeholder="10-digit mobile number"
              aria-invalid={!!errors.candidatePhone}
              className={cn(
                'rounded-xl',
                errors.candidatePhone && 'border-rose-400 focus-visible:ring-rose-300'
              )}
            />
            {errors.candidatePhone ? (
              <FieldErrorMsg message={errors.candidatePhone} />
            ) : (
              <p className="text-[11px] text-muted-foreground">Required — exactly 10 digits</p>
            )}
          </div>

          <div className="space-y-1.5" id="interview-field-candidateRole">
            <Label>
              Role <span className="text-destructive">*</span>
            </Label>
            <Select
              value={rolePreset}
              onValueChange={(v) => {
                setRolePreset(v)
                if (errors.candidateRole) clearFieldError('candidateRole')
              }}
            >
              <SelectTrigger
                aria-invalid={!!errors.candidateRole}
                className={cn(
                  'rounded-xl',
                  errors.candidateRole && 'border-rose-400 focus:ring-rose-300'
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_PRESETS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rolePreset === 'Other (type below)' && (
              <Input
                value={roleCustom}
                onChange={(e) => {
                  setRoleCustom(e.target.value)
                  if (errors.candidateRole) clearFieldError('candidateRole')
                }}
                placeholder="Type role / designation"
                aria-invalid={!!errors.candidateRole}
                className={cn(
                  'rounded-xl mt-2',
                  errors.candidateRole && 'border-rose-400 focus-visible:ring-rose-300'
                )}
              />
            )}
            {errors.candidateRole && <FieldErrorMsg message={errors.candidateRole} />}
          </div>

          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select
              value={departmentId || '__none__'}
              onValueChange={(v) => setDepartmentId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-600" />
              Interview panel (employees)
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start rounded-xl border-dashed border-violet-300"
                >
                  {participantIds.size === 0
                    ? 'Tap to add people'
                    : `${participantIds.size} selected`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(100vw-2rem,320px)] p-2" align="start">
                <Input
                  placeholder="Search name or email"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className="mb-2 rounded-lg"
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredEmployees.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleParticipant(e.user.id)}
                      className={cn(
                        'w-full text-left rounded-lg px-2 py-1.5 text-sm transition-colors',
                        participantIds.has(e.user.id)
                          ? 'bg-violet-600 text-white'
                          : 'hover:bg-muted'
                      )}
                    >
                      <div className="font-medium">{e.user.name}</div>
                      <div className="text-xs opacity-80 truncate">{e.user.email}</div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {participantIds.size > 0 && (
              <div className="flex flex-wrap gap-1">
                {employees
                  .filter((e) => participantIds.has(e.user.id))
                  .map((e) => (
                    <Badge
                      key={e.user.id}
                      variant="secondary"
                      className="rounded-full cursor-pointer"
                      onClick={() => toggleParticipant(e.user.id)}
                    >
                      {e.user.name} ×
                    </Badge>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Agenda, feedback, etc."
              className="rounded-xl resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Resume
            </Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="rounded-xl text-sm"
              onChange={(e) => {
                setResumeFile(e.target.files?.[0] ?? null)
                setResumeUrl(null)
              }}
            />
            {resumeUrl && !resumeFile && (
              <p className="text-xs text-muted-foreground">Uploaded ✓</p>
            )}
          </div>
        </div>

        <SheetFooter className="border-t bg-muted/20 px-3 py-3 md:p-4 flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md"
            disabled={
              createMutation.isPending ||
              updateMutation.isPending ||
              uploading
            }
            onClick={submit}
          >
            {createMutation.isPending || updateMutation.isPending || uploading
              ? 'Saving…'
              : isEdit
                ? 'Save changes'
                : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
