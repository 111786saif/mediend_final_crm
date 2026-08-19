'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Cake } from 'lucide-react'
import { format } from 'date-fns'

interface UpcomingBirthdayItem {
  id: string
  userId: string
  name: string
  dateOfBirth: string
  birthdayOn: string
  daysUntil: number
  department: string | null
}

function daysUntilLabel(daysUntil: number) {
  if (daysUntil === 1) return 'Tomorrow'
  return `In ${daysUntil} days`
}

export function UpcomingBirthdayCard() {
  const { data: birthdays = [], isLoading } = useQuery<UpcomingBirthdayItem[]>({
    queryKey: ['birthdays-upcoming'],
    queryFn: () => apiGet<UpcomingBirthdayItem[]>('/api/employees/birthdays?upcoming=true'),
  })

  if (isLoading || birthdays.length === 0) return null

  return (
    <Card className="border-violet-200 dark:border-violet-900/50 bg-violet-50/30 dark:bg-violet-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Cake className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          Upcoming Birthdays
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 max-h-64 overflow-y-auto overscroll-contain pr-1">
          {birthdays.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-violet-200 dark:border-violet-900/50 bg-white/60 dark:bg-violet-950/30 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {format(new Date(item.birthdayOn), 'EEE, d MMM')}
                  {item.department ? ` · ${item.department}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium text-violet-700 dark:text-violet-300">
                {daysUntilLabel(item.daysUntil)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Birthdays in the next 14 days
        </p>
      </CardContent>
    </Card>
  )
}
