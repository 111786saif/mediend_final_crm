import { AuthenticatedLayout } from "@/components/authenticated-layout"
import { MDOutstandingDashboard } from "@/components/md/outstanding/md-outstanding-dashboard"

export default function MDOutstandingPage() {
  return (
    <AuthenticatedLayout>
      <MDOutstandingDashboard />
    </AuthenticatedLayout>
  )
}
