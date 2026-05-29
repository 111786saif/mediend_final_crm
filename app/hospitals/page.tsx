'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Building2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedRoute } from '@/components/protected-route'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiGet } from '@/lib/api-client'
import { formatPlRupee } from '@/lib/pl/resolve-pl-row'

type Hospital = {
  name: string
  totalCases: number
  amountReceived: number
  pendingOutstanding: number
  mediendShare: number
}

type Preset = 'all' | 'mtd' | 'lastMonth' | 'qtd' | 'ytd' | 'custom'

function fmtYmd(d: Date): string {
  return d.toISOString().split('T')[0]
}

function rangeForPreset(p: Preset, customStart: string, customEnd: string) {
  if (p === 'all') return { start: '', end: '' }
  const now = new Date()
  if (p === 'custom') return { start: customStart || '', end: customEnd || '' }
  if (p === 'mtd') {
    return { start: fmtYmd(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmtYmd(now) }
  }
  if (p === 'lastMonth') {
    return {
      start: fmtYmd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      end: fmtYmd(new Date(now.getFullYear(), now.getMonth(), 0)),
    }
  }
  if (p === 'qtd') {
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    return { start: fmtYmd(qStart), end: fmtYmd(now) }
  }
  return { start: fmtYmd(new Date(now.getFullYear(), 0, 1)), end: fmtYmd(now) }
}

export default function HospitalsListPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [preset, setPreset] = useState<Preset>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    const now = new Date()
    setCustomEnd(fmtYmd(now))
    setCustomStart(fmtYmd(new Date(now.getFullYear(), now.getMonth(), 1)))
  }, [])

  useEffect(() => {
    setDateRange(rangeForPreset(preset, customStart, customEnd))
  }, [preset, customStart, customEnd])

  const { data, isLoading } = useQuery<Hospital[]>({
    queryKey: ['hospitals', 'list', dateRange],
    queryFn: () => {
      const params = new URLSearchParams()
      if (dateRange.start && dateRange.end) {
        params.set('startDate', dateRange.start)
        params.set('endDate', dateRange.end)
      }
      const qs = params.toString()
      return apiGet<Hospital[]>(`/api/hospitals${qs ? `?${qs}` : ''}`)
    },
  })

  const rows = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return q ? data.filter((h) => h.name.toLowerCase().includes(q)) : data
  }, [data, search])

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-indigo-50/40 p-6 dark:from-slate-950 dark:via-sky-950/20 dark:to-slate-900">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-1.5 rounded-full bg-gradient-to-b from-sky-500 to-indigo-600 shadow-sm" aria-hidden />
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-sky-800 via-indigo-700 to-sky-900 bg-clip-text text-transparent dark:from-sky-200 dark:via-indigo-200 dark:to-sky-100">
                  Hospital List
                </h1>
                <p className="text-muted-foreground mt-1">
                  All hospitals with MediEND amounts received, pending, and total share.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1 rounded-lg border border-sky-200/60 bg-sky-50/80 p-1 shadow-sm dark:border-sky-800/40 dark:bg-sky-950/30">
                {(
                  [
                    ['all', 'All time'],
                    ['mtd', 'MTD'],
                    ['lastMonth', 'Last month'],
                    ['qtd', 'QTD'],
                    ['ytd', 'YTD'],
                    ['custom', 'Custom'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    type="button"
                    variant={preset === key ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8"
                    onClick={() => setPreset(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {preset === 'custom' && (
                <div className="flex items-center gap-2">
                  <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-[140px]" />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-[140px]" />
                </div>
              )}
            </div>
          </div>

          <Card className="overflow-hidden border-sky-200/50 shadow-md dark:border-sky-800/40">
            <CardHeader className="border-b bg-gradient-to-r from-sky-500/10 to-indigo-500/8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sky-950 dark:text-sky-100">
                    <Building2 className="h-5 w-5" />
                    Hospitals
                  </CardTitle>
                  <CardDescription>Click a row for case-level details</CardDescription>
                </div>
                <div className="relative w-full sm:w-[260px]">
                  <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by hospital name"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-sky-50/40 hover:bg-sky-50/40 dark:bg-sky-950/20">
                    <TableHead>Hospital</TableHead>
                    <TableHead className="text-right">Cases</TableHead>
                    <TableHead className="text-right">Amount Received</TableHead>
                    <TableHead className="text-right">Pending Outstanding</TableHead>
                    <TableHead className="text-right">MediEND Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No hospitals found
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((h) => (
                      <TableRow
                        key={h.name}
                        className="cursor-pointer hover:bg-sky-50/40 dark:hover:bg-sky-950/15"
                        onClick={() => {
                          const qs = dateRange.start && dateRange.end
                            ? `?startDate=${dateRange.start}&endDate=${dateRange.end}`
                            : ''
                          router.push(`/hospitals/${encodeURIComponent(h.name)}${qs}`)
                        }}
                      >
                        <TableCell className="font-medium">{h.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{h.totalCases}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPlRupee(h.amountReceived || null)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPlRupee(h.pendingOutstanding || null)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPlRupee(h.mediendShare || null)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}
