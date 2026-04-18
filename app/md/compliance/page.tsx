"use client"

import { AuthenticatedLayout } from "@/components/authenticated-layout"
import { MDComplianceDashboard } from "@/components/md/compliance/md-compliance-dashboard"

export default function MDCompliancePage() {
  return (
    <AuthenticatedLayout>
      <MDComplianceDashboard />
    </AuthenticatedLayout>
  )
}
