'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { MDAttendancePage } from '@/components/md/attendance/md-attendance-page'

export default function MDAttendancePageWrapper() {
  return (
    <AuthenticatedLayout>
      <MDAttendancePage />
    </AuthenticatedLayout>
  )
}
