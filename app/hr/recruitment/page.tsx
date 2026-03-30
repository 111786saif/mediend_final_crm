'use client'

import { useState } from 'react'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { InterviewFormSheet } from '@/components/hr/interview-form-sheet'
import { InterviewList, type InterviewMeet } from '@/components/hr/interview-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function HRRecruitmentPage() {
  const [open, setOpen] = useState(false)
  const [meetToEdit, setMeetToEdit] = useState<InterviewMeet | null>(null)

  return (
    <AuthenticatedLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 bg-clip-text text-transparent">
              Recruitment
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Schedule interviews, invite panelists, upload resumes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link href="/meets">All meets</Link>
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md"
              onClick={() => {
                setMeetToEdit(null)
                setOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Schedule
            </Button>
          </div>
        </div>

        <InterviewList
          onEdit={(m) => {
            setMeetToEdit(m)
            setOpen(true)
          }}
        />

        <Button
          className="fixed bottom-20 right-3 z-30 md:bottom-8 md:right-8 h-14 w-14 rounded-full shadow-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 p-0 md:hidden"
          onClick={() => {
            setMeetToEdit(null)
            setOpen(true)
          }}
          aria-label="Schedule interview"
        >
          <Plus className="h-7 w-7" />
        </Button>

        <InterviewFormSheet
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) setMeetToEdit(null)
          }}
          meetToEdit={meetToEdit}
        />
      </div>
    </AuthenticatedLayout>
  )
}
