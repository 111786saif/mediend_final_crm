'use client'

import { useState, useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Users } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table'
import { ColumnFilter } from '@/components/ui/column-filter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface CampaignTeamRow {
  campaignName: string
  team: string
  leads: number
  conversionPercentage: number
  cpl: number | null
  amountSpend: number | null
}

export interface SourceTeamRow {
  sourceName: string
  team: string
  leads: number
  conversionPercentage: number
  cpl: number | null
  amountSpend: number | null
}

function formatConversion(pct: number) {
  if (pct === 0) return (
    <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-muted text-muted-foreground border border-border">
      0.0%
    </span>
  )
  if (pct < 30) return (
    <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
      {pct.toFixed(1)}%
    </span>
  )
  return (
    <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
      {pct.toFixed(1)}%
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center bg-card border border-dashed border-border rounded-xl">
      <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

interface TeamMappingSectionProps {
  view: 'source' | 'campaign'
  data: any[]
}

export function TeamMappingSection({ view, data }: TeamMappingSectionProps) {
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [searchName, setSearchName] = useState<string>('')

  // Compute distinct teams present in data to populate the ColumnFilter dropdown options
  const teamOptions = useMemo(() => {
    const allTeams = data.map((r) => r.team).filter(Boolean)
    return Array.from(new Set(allTeams))
  }, [data])

  // Filter dataset client-side based on search query and team selection
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      const name = (view === 'campaign' ? (row.campaignName || row.campaign) : (row.sourceName || row.source)) || ''
      const team = row.team || ''
      
      const matchesName = !searchName || name.toLowerCase().includes(searchName.toLowerCase())
      const matchesTeam = selectedTeams.length === 0 || selectedTeams.includes(team)
      
      return matchesName && matchesTeam
    })
  }, [data, view, searchName, selectedTeams])

  // Define columns inside component to capture current state and option values dynamically
  const columns = useMemo<ColumnDef<any>[]>(() => {
    const nameColumn: ColumnDef<any> = {
      accessorKey: view === 'campaign' ? 'campaignName' : 'sourceName',
      header: ({ column }) => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[180px]">
          <Button
            variant="ghost"
            className="p-0 hover:bg-transparent text-xs font-bold text-muted-foreground uppercase"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {view === 'campaign' ? 'Campaign Name' : 'Source Name'}
            <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <ColumnFilter
            type="search"
            placeholder={view === 'campaign' ? 'Search campaign...' : 'Search source...'}
            value={searchName}
            onChange={(val) => setSearchName(val as string)}
          />
        </div>
      ),
      cell: ({ row }) => {
        const name = (view === 'campaign' 
          ? (row.original.campaignName || row.original.campaign) 
          : (row.original.sourceName || row.original.source)) || '—'
        return <span className="font-bold text-foreground text-sm">{name}</span>
      },
    }

    return [
      nameColumn,
      {
        accessorKey: 'team',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[120px]">
            <span className="text-xs font-bold text-muted-foreground uppercase">Team</span>
            <ColumnFilter
              type="multiSelect"
              options={teamOptions}
              value={selectedTeams}
              onChange={(val) => setSelectedTeams(val as string[])}
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className={cn(
            "px-3.5 py-1.5 rounded text-[11px] font-semibold border tracking-wide",
            row.original.team === 'Independent'
              ? "bg-muted text-muted-foreground border-border"
              : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
          )}>
            {row.original.team}
          </span>
        ),
      },
      {
        accessorKey: 'leads',
        header: ({ column }) => (
          <div className="text-right w-full">
            <Button
              variant="ghost"
              className="p-0 hover:bg-transparent text-xs font-bold text-muted-foreground uppercase"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Leads
              <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right w-full font-semibold text-foreground text-sm pr-4">
            {row.original.leads}
          </div>
        ),
      },
      {
        accessorKey: 'conversionPercentage',
        header: ({ column }) => (
          <div className="text-right w-full pr-4">
            <Button
              variant="ghost"
              className="p-0 hover:bg-transparent text-xs font-bold text-muted-foreground uppercase"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Conversion %
              <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right w-full pr-4">
            {formatConversion(row.original.conversionPercentage)}
          </div>
        ),
      },
      {
        accessorKey: 'cpl',
        header: ({ column }) => (
          <div className="text-right w-full">
            <Button
              variant="ghost"
              className="p-0 hover:bg-transparent text-xs font-bold text-muted-foreground uppercase"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              CPL
              <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div className={cn("w-full", row.original.cpl != null ? "text-right" : "text-center")}>
            <span className={cn("text-sm", row.original.cpl != null ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground/40")}>
              {row.original.cpl != null ? `₹${row.original.cpl.toLocaleString('en-IN')}` : '—'}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'amountSpend',
        header: ({ column }) => (
          <div className="text-right w-full">
            <Button
              variant="ghost"
              className="p-0 hover:bg-transparent text-xs font-bold text-muted-foreground uppercase"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Amount Spend
              <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div className={cn("w-full", row.original.amountSpend != null ? "text-right" : "text-center")}>
            <span className={cn("text-sm", row.original.amountSpend != null ? "text-foreground font-medium" : "text-muted-foreground/40")}>
              {row.original.amountSpend != null ? `₹${row.original.amountSpend.toLocaleString('en-IN')}` : '—'}
            </span>
          </div>
        ),
      },
    ]
  }, [view, selectedTeams, searchName, teamOptions])

  return (
    <Card className="bg-card border border-border overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-4 border-b border-border bg-muted/30">
        <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          {view === 'source' ? 'Source to Team Mapping' : 'Campaign to Team Mapping'}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1 font-medium">
          {view === 'source'
            ? 'Shows source performance broken down by team.'
            : 'Shows campaign performance broken down by team.'}
        </p>
      </CardHeader>
      <CardContent className="p-4">
        {filteredData.length > 0 ? (
          <div className="p-2">
            <DataTable
              columns={columns}
              data={filteredData}
              enablePagination={true}
              initialPageSize={10}
            />
          </div>
        ) : (
          <div className="p-6">
            <EmptyState message={`No ${view === 'source' ? 'source' : 'campaign'} mapping data available for the selected filters.`} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
