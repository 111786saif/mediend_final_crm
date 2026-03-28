'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { MDAttendancePage } from '@/components/md/attendance/md-attendance-page'

export default function MDAttendancePageWrapper() {
  return (
    <AuthenticatedLayout>
      <div className="min-h-full min-w-0 overflow-x-hidden bg-gradient-to-b from-teal-50/90 via-background to-violet-50/80 dark:from-teal-950/25 dark:via-background dark:to-violet-950/20">
        <MDAttendancePage />
      </div>
    </AuthenticatedLayout>
  )
}
