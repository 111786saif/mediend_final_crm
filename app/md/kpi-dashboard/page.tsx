import { redirect } from 'next/navigation'

/** Legacy MD link retained so dashboard menu bookmarks always reach the unified KPI dashboard. */
export default function MdKpiDashboardPage() {
  redirect('/kpi-dashboard')
}
