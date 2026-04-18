import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query"
import { apiGet, apiPatch } from "@/lib/api-client"

export type ComplianceCallStatus =
  | "PENDING"
  | "COMPLETED"
  | "DID_NOT_PICK"
  | "WRONG_NUMBER"
  | "CALLBACK_SCHEDULED"

export type ComplianceCallSort = "recent" | "highest" | "lowest" | "pending"

export interface ComplianceCallLead {
  id: string
  leadRef: string
  patientName: string
  phoneNumber: string
  treatment: string | null
  hospitalName: string
  surgeonName: string | null
  caseStage: string
  flowType: string
  bd: { id: string; name: string } | null
  dischargeSheet: {
    id: string
    dischargeDate: string | null
    bdmName: string | null
    managerName: string | null
  } | null
}

export interface ComplianceCall {
  id: string
  leadId: string
  status: ComplianceCallStatus
  rating: number | null
  notes: string | null
  lastAttemptedAt: string | null
  completedAt: string | null
  callbackAt: string | null
  createdAt: string
  updatedAt: string
  lead: ComplianceCallLead
  calledBy: { id: string; name: string } | null
}

export interface ComplianceCallsFilters {
  status?: ComplianceCallStatus | null
  rating?: number | null
  startDate?: string | null
  endDate?: string | null
  sort?: ComplianceCallSort
}

export interface ComplianceStats {
  byRating: Record<"1" | "2" | "3" | "4" | "5", number>
  pending: number
  totalCompleted: number
  averageRating: number | null
}

interface ComplianceCallsPage {
  calls: ComplianceCall[]
  nextCursor: string | null
}

function buildQueryString(filters: ComplianceCallsFilters, cursor?: string) {
  const params = new URLSearchParams()
  if (filters.status) params.set("status", filters.status)
  if (filters.rating != null) params.set("rating", String(filters.rating))
  if (filters.startDate) params.set("startDate", filters.startDate)
  if (filters.endDate) params.set("endDate", filters.endDate)
  if (filters.sort) params.set("sort", filters.sort)
  if (cursor) params.set("cursor", cursor)
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

export function useComplianceCalls(filters: ComplianceCallsFilters = {}) {
  return useInfiniteQuery<
    ComplianceCallsPage,
    Error,
    InfiniteData<ComplianceCallsPage>,
    readonly unknown[],
    string | null
  >({
    queryKey: ["compliance", "calls", filters],
    queryFn: ({ pageParam }) =>
      apiGet<ComplianceCallsPage>(
        `/api/compliance/calls${buildQueryString(filters, pageParam ?? undefined)}`,
      ),
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor,
  })
}

export function useComplianceStats(range: { startDate?: string; endDate?: string } = {}) {
  const params = new URLSearchParams()
  if (range.startDate) params.set("startDate", range.startDate)
  if (range.endDate) params.set("endDate", range.endDate)
  const qs = params.toString()
  return useQuery<ComplianceStats>({
    queryKey: ["compliance", "stats", range],
    queryFn: () => apiGet<ComplianceStats>(`/api/compliance/stats${qs ? `?${qs}` : ""}`),
  })
}

export interface UpdateComplianceCallInput {
  id: string
  status?: ComplianceCallStatus
  rating?: number | null
  notes?: string | null
  callbackAt?: string | null
}

export function useUpdateComplianceCall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateComplianceCallInput) =>
      apiPatch<ComplianceCall>(`/api/compliance/calls/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance", "calls"] })
      qc.invalidateQueries({ queryKey: ["compliance", "stats"] })
    },
  })
}
