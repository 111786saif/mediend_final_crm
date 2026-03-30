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
import { Users, Upload, Video, MapPin, CalendarClock, History } from 'lucide-react'
import { isValid } from 'date-fns'
import { DateTimePicker } from '@/components/ui/date-time-picker'

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
  }, [])

  useEffect(() => {
    if (!open) return
    if (meetToEdit) {
      setMode(meetToEdit.isRecorded ? 'record' : 'schedule')
      setMeetType(meetToEdit.type)
      setCandidateName(meetToEdit.candidateName || '')
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

  const buildInterviewPayload = async () => {
    if (!candidateName.trim()) throw new Error('Candidate name is required')
    if (!resolvedRole) throw new Error('Role is required')
    if (!scheduledAt || !isValid(scheduledAt)) throw new Error('Date & time is required')
    if (meetType === 'OFFLINE' && !location.trim()) {
      throw new Error('Location is required for walk-in interviews')
    }

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

    return {
      candidateName: candidateName.trim(),
      candidateRole: resolvedRole,
      departmentId: departmentId || null,
      interviewRound: round,
      type: meetType,
      meetLink: meetType === 'VIRTUAL' ? meetLink.trim() || null : null,
      location: meetType === 'OFFLINE' ? location.trim() : null,
      scheduledAt: scheduledAt.toISOString(),
      notes: notes.trim() || null,
      participantUserIds: Array.from(participantIds),
      isRecorded: mode === 'record',
      resumeUrl: finalResumeUrl || null,
      title: displayTitle.trim() || null,
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
    onError: (e: Error) => toast.error(e.message || 'Failed to save'),
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
    onError: (e: Error) => toast.error(e.message || 'Failed to update'),
  })

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
            <div className="space-y-1.5">
              <Label>Google Meet / video link</Label>
              <Input
                value={meetLink}
                onChange={(e) => setMeetLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="rounded-xl"
              />
            </div>
          )}

          {meetType === 'OFFLINE' && (
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Office / floor / room"
                className="rounded-xl"
              />
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
            <div className="space-y-1.5">
              <Label>Round</Label>
              <Input
                type="number"
                min={1}
                max={99}
                value={round}
                onChange={(e) => setRound(parseInt(e.target.value, 10) || 1)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label id="interview-when-label">When</Label>
              <DateTimePicker
                nested
                value={scheduledAt}
                onChange={setScheduledAt}
                aria-labelledby="interview-when-label"
                className="rounded-xl min-h-11 h-auto py-2.5"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Candidate name</Label>
            <Input
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="Full name"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={rolePreset} onValueChange={setRolePreset}>
              <SelectTrigger className="rounded-xl">
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
                onChange={(e) => setRoleCustom(e.target.value)}
                placeholder="Type role / designation"
                className="rounded-xl mt-2"
              />
            )}
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
            onClick={() =>
              isEdit ? updateMutation.mutate() : createMutation.mutate()
            }
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
