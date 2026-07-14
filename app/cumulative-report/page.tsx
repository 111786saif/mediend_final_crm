"use client"

import { AuthenticatedLayout } from "@/components/authenticated-layout"
import { CumulativeReportView } from "@/components/cumulative-report/cumulative-report-view"

export default function CumulativeReportPage() {
  return (
    <AuthenticatedLayout>
      <CumulativeReportView />
    </AuthenticatedLayout>
  )
}
