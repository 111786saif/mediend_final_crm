'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserPlus } from 'lucide-react'

interface NewJoinerItem {
  id: string
  userId: string
  name: string
  joinDate: string
  designation: string | null
  department: string | null
}

export function NewJoinerCelebrationCard() {
  const { data: joiners = [], isLoading } = useQuery<NewJoinerItem[]>({
    queryKey: ['new-joiners-today'],
    queryFn: () => apiGet<NewJoinerItem[]>('/api/employees/new-joiners'),
  })

  if (isLoading || joiners.length === 0) return null

  return (
    <Card className="border-sky-200 dark:border-sky-900/50 bg-sky-50/30 dark:bg-sky-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          New Joiners Today 🎉
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {joiners.map((item) => {
            const detail = [item.designation, item.department].filter(Boolean).join(' · ')
            return (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-sky-200 dark:border-sky-900/50 bg-white/60 dark:bg-sky-950/30 px-3 py-2"
              >
                <span className="text-lg">👋</span>
                <div className="min-w-0">
                  <span className="font-medium">{item.name}</span>
                  {detail ? (
                    <p className="text-xs text-muted-foreground truncate">{detail}</p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Please welcome them to the team!
        </p>
      </CardContent>
    </Card>
  )
}
