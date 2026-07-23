import { Metadata } from 'next'
import { BluePrintTable } from './components/blueprint-table'

export const metadata: Metadata = {
  title: 'Blue Print Dashboard | MediEND',
  description: 'Sales Blue Print Dashboard',
}

export default function BluePrintDashboardPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Blue Print Dashboard</h2>
      </div>
      
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <BluePrintTable />
      </div>
    </div>
  )
}
