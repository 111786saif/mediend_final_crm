'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  MoreVertical,
  ChevronLeft,
  Video,
  FileText,
  UserCheck,
  UserX,
  ClipboardList,
} from 'lucide-react'
import { apiPatch } from '@/lib/api-client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export type MeetCardActionMeet = {
  id: string
  title: string
  module: 'INTERVIEW' | 'MD_APPOINTMENT' | 'GENERAL'
  meetLink: string | null
  resumeUrl: string | null
}

type Props = {
  meet: MeetCardActionMeet
  myAttended: boolean | null
  myRemarks: string | null
}

export function MeetCardActions({ meet, myAttended, myRemarks }: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'attendance'>('menu')
  const [attended, setAttended] = useState<boolean | null>(null)
  const [remarks, setRemarks] = useState('')

  const queryClient = useQueryClient()

  useEffect(() => {
    if (open) {
      setView('menu')
      setAttended(myAttended)
      setRemarks(myRemarks ?? '')
    }
  }, [open, myAttended, myRemarks])

  const saveMutation = useMutation({
    mutationFn: (body: { attended?: boolean; remarks?: string | null }) =>
      apiPatch<{ id: string; attended: boolean | null; remarks: string | null }>(
        `/api/meets/${meet.id}/my-attendance`,
        body
      ),
    onSuccess: () => {
      toast.success('Saved')
      queryClient.invalidateQueries({ queryKey: ['meets'] })
      setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save'),
  })

  const handleSaveAttendance = () => {
    const trimmed = remarks.trim()
    const payload: { attended?: boolean; remarks?: string | null } = {}
    if (attended !== null) payload.attended = attended
    payload.remarks = trimmed || null
    if (attended === null && !trimmed) {
      toast.error('Choose joined or did not join, or add a remark')
      return
    }
    saveMutation.mutate(payload)
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full touch-manipulation -mr-1"
        aria-label="Meet actions"
        onClick={() => setOpen(true)}
      >
        <MoreVertical className="h-5 w-5" />
      </Button>

      <Drawer open={open} onOpenChange={setOpen} direction="bottom" repositionInputs={false}>
        <DrawerContent
          className={cn(
            'inset-x-0 bottom-0 mt-0 flex flex-col rounded-t-2xl border-t border-border bg-card',
            view === 'menu' ? 'max-h-[min(55dvh,440px)]' : 'max-h-[min(92dvh,680px)]',
            '[&>div:first-child]:hidden'
          )}
        >
          {view === 'menu' ? (
            <>
              <DrawerHeader className="border-b border-border py-3 px-4">
                <DrawerTitle className="text-lg font-semibold text-left">Actions</DrawerTitle>
                <p className="text-sm text-muted-foreground font-normal text-left truncate">
                  {meet.title}
                </p>
              </DrawerHeader>
              <ScrollArea className="flex-1 min-h-0">
                <div className="py-1 pb-3">
                  <button
                    type="button"
                    className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left text-base active:bg-muted/50 touch-manipulation"
                    onClick={() => setView('attendance')}
                  >
                    <ClipboardList className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="font-medium">Your attendance & remarks</span>
                  </button>
                  {meet.meetLink && (
                    <a
                      href={meet.meetLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left text-base active:bg-muted/50 touch-manipulation text-foreground"
                      onClick={() => setOpen(false)}
                    >
                      <Video className="h-5 w-5 shrink-0 text-indigo-600" />
                      <span className="font-medium">Open join link</span>
                    </a>
                  )}
                  {meet.module === 'INTERVIEW' && meet.resumeUrl && (
                    <a
                      href={meet.resumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left text-base active:bg-muted/50 touch-manipulation text-foreground"
                      onClick={() => setOpen(false)}
                    >
                      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <span className="font-medium">Open resume</span>
                    </a>
                  )}
                </div>
              </ScrollArea>
              <DrawerFooter className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <Button variant="outline" className="w-full rounded-xl h-11" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </DrawerFooter>
            </>
          ) : (
            <>
              <DrawerHeader className="flex flex-row items-center gap-1 border-b border-border py-2 px-1 pr-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 rounded-full h-10 w-10"
                  aria-label="Back"
                  onClick={() => setView('menu')}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0 flex-1 text-left">
                  <DrawerTitle className="text-lg font-semibold">Your attendance</DrawerTitle>
                  <p className="text-xs text-muted-foreground font-normal truncate">{meet.title}</p>
                </div>
              </DrawerHeader>
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4 p-4 pb-2">
                  <div>
                    <p className="text-sm font-medium mb-2">Did you join?</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={attended === true ? 'default' : 'outline'}
                        className={cn(
                          'h-12 rounded-xl text-sm sm:text-base',
                          attended === true && 'bg-emerald-600 hover:bg-emerald-700'
                        )}
                        onClick={() => setAttended(true)}
                      >
                        <UserCheck className="h-4 w-4 mr-1.5 shrink-0" />
                        Joined
                      </Button>
                      <Button
                        type="button"
                        variant={attended === false ? 'default' : 'outline'}
                        className={cn(
                          'h-12 rounded-xl text-sm sm:text-base',
                          attended === false && 'bg-rose-600 hover:bg-rose-700'
                        )}
                        onClick={() => setAttended(false)}
                      >
                        <UserX className="h-4 w-4 mr-1.5 shrink-0" />
                        Did not join
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`meet-remarks-${meet.id}`} className="text-sm font-medium">
                      Remarks (optional)
                    </Label>
                    <Textarea
                      id={`meet-remarks-${meet.id}`}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Notes for you or your manager…"
                      className="mt-2 min-h-[100px] rounded-xl text-base resize-y"
                      maxLength={2000}
                    />
                    <p className="text-xs text-muted-foreground mt-1 text-right">{remarks.length}/2000</p>
                  </div>
                </div>
              </ScrollArea>
              <DrawerFooter className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto rounded-xl h-11"
                  onClick={() => setView('menu')}
                >
                  Back
                </Button>
                <Button
                  className="w-full sm:w-auto rounded-xl h-11 bg-indigo-600 hover:bg-indigo-700"
                  disabled={saveMutation.isPending}
                  onClick={handleSaveAttendance}
                >
                  Save
                </Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}
