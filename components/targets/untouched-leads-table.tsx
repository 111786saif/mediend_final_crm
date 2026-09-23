'use client'

import { useMemo, useState, useEffect } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { DataTable } from '@/components/ui/data-table'
import { ColumnFilter } from '@/components/ui/column-filter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, UserPlus, Search, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAvatarColor } from '@/lib/avatar-colors'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface TeamInfo {
  id: string
  name: string
  members: Array<{
    id: string
    name: string
    profilePicture: string | null
  }>
}

interface UntouchedLeadsTableProps {
  teams: TeamInfo[]
}

interface UntouchedLead {
  id: number
  leadRef: string
  patientName: string
  status: string
  source: string | null
  category?: string | null
  treatment?: string | null
  createdDate: string
  leadEntryDate?: string | null
  inactive?: string
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export function UntouchedLeadsTable({ teams }: UntouchedLeadsTableProps) {
  const queryClient = useQueryClient()
  const [selectedLead, setSelectedLead] = useState<UntouchedLead | null>(null)
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Multi-column filter state variables
  const [leadRefFilter, setLeadRefFilter] = useState<string>('')
  const [patientNameFilter, setPatientNameFilter] = useState<string>('')
  const [sourceFilter, setSourceFilter] = useState<string[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [treatmentFilter, setTreatmentFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [inactiveFilter, setInactiveFilter] = useState<string[]>([])

  // Server-side pagination state
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  // Reset page index on filter changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [
    leadRefFilter,
    patientNameFilter,
    sourceFilter,
    categoryFilter,
    treatmentFilter,
    statusFilter,
    inactiveFilter,
  ])

  // Query untouched leads with backend filters and server-side pagination
  const { data: leadsResponse, isLoading } = useQuery<{
    leads: UntouchedLead[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }>({
    queryKey: [
      'untouched-leads',
      leadRefFilter,
      patientNameFilter,
      sourceFilter,
      categoryFilter,
      treatmentFilter,
      statusFilter,
      inactiveFilter,
      pagination.pageIndex,
      pagination.pageSize,
    ],
    queryFn: async () => {
      const filters: Array<{ field: string; operator: string; value: unknown }> = []

      if (leadRefFilter.trim())
        filters.push({ field: 'leadRef', operator: 'contains', value: leadRefFilter })
      if (patientNameFilter.trim())
        filters.push({ field: 'patientName', operator: 'contains', value: patientNameFilter })
      if (sourceFilter.length > 0)
        filters.push({ field: 'source', operator: 'in', value: sourceFilter })
      if (categoryFilter.length > 0)
        filters.push({ field: 'category', operator: 'in', value: categoryFilter })
      if (treatmentFilter.trim())
        filters.push({ field: 'treatment', operator: 'contains', value: treatmentFilter })
      if (statusFilter.length > 0)
        filters.push({ field: 'status', operator: 'in', value: statusFilter })
      if (inactiveFilter.length > 0)
        filters.push({ field: 'inactive', operator: 'in', value: inactiveFilter })

      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        limit: String(pagination.pageSize),
      })
      if (filters.length > 0) {
        params.set('filters', JSON.stringify(filters))
      }

      return apiGet<{
        leads: UntouchedLead[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }>(`/api/analytics/sales-dashboard/untouched-leads?${params.toString()}`)
    },
  })

  // Query dynamic filter config options from backend
  const { data: filterConfig } = useQuery<{
    filters: Array<{
      field: string
      label: string
      filterType: string
      filterable: boolean
      options?: Array<{ label: string; value: string }>
    }>
  }>({
    queryKey: ['untouched-leads', 'filter-config'],
    queryFn: () => apiGet('/api/analytics/sales-dashboard/untouched-leads/filter-config'),
    staleTime: 5 * 60 * 1000,
  })

  // Map raw leads from backend
  const leads = useMemo(() => {
    return leadsResponse?.leads ?? []
  }, [leadsResponse])

  const pageCount = leadsResponse?.pagination?.totalPages ?? 0

  // Extract dynamically queried options
  const sourceOptions = useMemo(() => {
    return filterConfig?.filters.find((f) => f.field === 'source')?.options ?? []
  }, [filterConfig])

  const categoryOptions = useMemo(() => {
    return filterConfig?.filters.find((f) => f.field === 'category')?.options ?? []
  }, [filterConfig])

  const statusOptions = useMemo(() => {
    return filterConfig?.filters.find((f) => f.field === 'status')?.options ?? []
  }, [filterConfig])

  const inactiveOptions = useMemo(() => {
    return filterConfig?.filters.find((f) => f.field === 'inactive')?.options ?? []
  }, [filterConfig])

  const totalLeads = leadsResponse?.pagination?.total ?? 0

  // Flatten all BDs from teams for assignment
  const allBDs = useMemo(() => {
    return teams.flatMap((t) =>
      t.members.map((m) => ({
        id: m.id,
        name: m.name,
        profilePicture: m.profilePicture,
        teamLead: t.name,
      }))
    )
  }, [teams])

  const filteredBDs = useMemo(() => {
    if (!searchQuery.trim()) return allBDs
    const query = searchQuery.toLowerCase()
    return allBDs.filter(
      (bd) =>
        bd.name.toLowerCase().includes(query) ||
        bd.teamLead.toLowerCase().includes(query)
    )
  }, [allBDs, searchQuery])

  const assignLeadMutation = useMutation({
    mutationFn: ({ leadId, bdId }: { leadId: number; bdId: string }) =>
      apiPatch(`/api/leads/${leadId}`, { bdId }),
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['untouched-leads'] })
      setIsAssignOpen(false)
      setSelectedLead(null)
      toast.success('Lead assigned successfully!')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to assign lead')
    },
  })

  const handleAssignClick = (lead: UntouchedLead) => {
    setSelectedLead(lead)
    setIsAssignOpen(true)
    setSearchQuery('')
  }

  const handleConfirmAssignment = (bdName: string, bdId: string) => {
    if (!selectedLead) return
    assignLeadMutation.mutate({ leadId: selectedLead.id, bdId })
  }

  const columns = useMemo<ColumnDef<UntouchedLead>[]>(() => {
    return [
      {
        accessorKey: 'leadRef',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Lead Ref</span>
            <ColumnFilter type="search" value={leadRefFilter} onChange={setLeadRefFilter} placeholder="Search Ref..." />
          </div>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
            {row.original.leadRef}
          </span>
        ),
      },
      {
        accessorKey: 'patientName',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Patient Name</span>
            <ColumnFilter type="search" value={patientNameFilter} onChange={setPatientNameFilter} placeholder="Search Patient..." />
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-bold text-foreground">
            {row.original.patientName}
          </span>
        ),
      },
      {
        accessorKey: 'leadEntryDate',
        header: 'Received Date',
        cell: ({ row }) => {
          const dateVal = row.original.leadEntryDate || row.original.createdDate
          return (
            <span className="text-xs text-muted-foreground">
              {dateVal ? format(new Date(dateVal), 'dd MMM yyyy') : '—'}
            </span>
          )
        },
      },
      {
        accessorKey: 'source',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Lead Source</span>
            <ColumnFilter type="multiSelect" options={sourceOptions} value={sourceFilter} onChange={setSourceFilter} />
          </div>
        ),
        cell: ({ row }) => (
          <span className="inline-block px-3 py-1 rounded-full bg-muted text-[10px] font-bold text-foreground border border-border">
            {row.original.source || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'category',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Category</span>
            <ColumnFilter type="multiSelect" options={categoryOptions} value={categoryFilter} onChange={setCategoryFilter} />
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.category || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'treatment',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Treatment</span>
            <ColumnFilter type="search" value={treatmentFilter} onChange={setTreatmentFilter} placeholder="Search Treatment..." />
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground truncate max-w-[120px] inline-block">
            {row.original.treatment || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'inactive',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Inactive</span>
            <ColumnFilter type="multiSelect" options={inactiveOptions} value={inactiveFilter} onChange={setInactiveFilter} />
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground italic">
            {row.original.inactive || 'N/A'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Status</span>
            <ColumnFilter type="multiSelect" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
          </div>
        ),
        cell: ({ row }) => {
          const status = row.original.status
          const isStagnant = status === 'Stagnant'
          const isUnassigned = status === 'Unassigned'
          
          return (
            <span className={cn(
              "px-3 py-1 rounded-full text-[10px] font-bold uppercase border",
              isStagnant 
                ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" 
                : isUnassigned 
                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" 
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
            )}>
              {status}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white transition-all gap-1 text-xs px-4 font-bold rounded-lg"
              onClick={() => handleAssignClick(row.original)}
              disabled={assignLeadMutation.isPending && selectedLead?.id === row.original.id}
            >
              <UserPlus className="h-3 w-3" />
              {assignLeadMutation.isPending && selectedLead?.id === row.original.id ? 'Assigning...' : 'Assign'}
            </Button>
          </div>
        ),
      },
    ]
  }, [
    leadRefFilter,
    patientNameFilter,
    sourceFilter,
    categoryFilter,
    treatmentFilter,
    statusFilter,
    sourceOptions,
    categoryOptions,
    statusOptions,
    inactiveOptions,
    assignLeadMutation.isPending,
    selectedLead,
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-rose-500 animate-pulse" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Untouched Leads Alerts
          </h3>
        </div>
        {totalLeads > 0 && (
          <span className="text-[10px] bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 rounded px-2.5 py-0.5 font-bold uppercase tracking-wider">
            {totalLeads} ACTION{totalLeads > 1 ? 'S' : ''} REQUIRED
          </span>
        )}
      </div>

      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden p-1">
        <DataTable
          columns={columns}
          data={leads}
          isLoading={isLoading}
          enablePagination={true}
          pageCount={pageCount}
          paginationState={pagination}
          onPaginationChange={setPagination}
          initialPageSize={10}
          pageSizeOptions={[5, 10, 20, 50]}
          emptyMessage="No untouched leads requiring action."
        />
      </div>

      {/* Assignment Modal */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="max-w-md bg-card border border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Assign Lead {selectedLead?.leadRef}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search BDE or Team Lead..."
                className="pl-9 bg-background border-border text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2 px-1">
                Active BDE Directory
              </Label>

              {filteredBDs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/30 border border-dashed border-border rounded-lg">
                  <HelpCircle className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No matching BDEs found</p>
                </div>
              ) : (
                filteredBDs.map((bd) => {
                  const bdColor = getAvatarColor(bd.name)
                  return (
                    <button
                      key={bd.id}
                      onClick={() => handleConfirmAssignment(bd.name, bd.id)}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left"
                      disabled={assignLeadMutation.isPending}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 border border-border">
                          {bd.profilePicture && <AvatarImage src={bd.profilePicture} />}
                          <AvatarFallback className={cn(bdColor.bg, bdColor.text, 'font-bold text-[10px]')}>
                            {getInitials(bd.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold text-foreground leading-none">
                            {bd.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Team Lead: {bd.teamLead}
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-bold uppercase rounded px-1.5 py-0.5">
                        BD
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
