"use client"

import { AuthenticatedLayout } from "@/components/authenticated-layout"
import { ComplianceOfficerDashboard } from "@/components/compliance/compliance-officer-dashboard"

export default function ComplianceDashboardPage() {
  return (
    <AuthenticatedLayout>
      <ComplianceOfficerDashboard />
    </AuthenticatedLayout>
  )
}
