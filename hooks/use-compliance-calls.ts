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

export type ComplianceCallSort = "recent" | "highest" | "lowest" | "pending" | "discharge"

export type SatisfactionLevel = "SATISFIED" | "NEUTRAL" | "NOT_SATISFIED"

export type ConcernCategory =
  | "HOSPITAL_STAFF"
  | "PAYMENT"
  | "BD"
  | "NO_UPDATE_FOLLOWUP"
  | "DOCTOR"
  | "SURGERY_RELATED"
  | "CAB_PAYMENT"
  | "OTHERS"

export const CONCERN_CATEGORY_LABEL: Record<ConcernCategory, string> = {
  HOSPITAL_STAFF: "Hospital / staff",
  PAYMENT: "Payment",
  BD: "BD",
  NO_UPDATE_FOLLOWUP: "No update follow-up",
  DOCTOR: "Doctor",
  SURGERY_RELATED: "Surgery related",
  CAB_PAYMENT: "Cab payment",
  OTHERS: "Others",
}

export const CONCERN_CATEGORIES: ConcernCategory[] = [
  "HOSPITAL_STAFF",
  "PAYMENT",
  "BD",
  "NO_UPDATE_FOLLOWUP",
  "DOCTOR",
  "SURGERY_RELATED",
  "CAB_PAYMENT",
  "OTHERS",
]

export interface ComplianceCallLead {
  id: string
  leadRef: string
  patientName: string
  phoneNumber: string
  treatment: string | null
  hospitalName: string
  surgeonName: string | null
  ipdDrName: string | null
  surgeryDate: string | null
  caseStage: string
  flowType: string
  bd: { id: string; name: string } | null
  dischargeSheet: {
    id: string
    dischargeDate: string | null
    bdmName: string | null
    managerName: string | null
    doctorName: string | null
    hospitalName: string | null
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

  problemDuringSurgery: string | null
  problemAfterSurgery: string | null
  commitmentStatus: string | null
  concernResolved: string | null
  doctorBehaviour: string | null
  hospitalStaffBehaviour: string | null
  bdmBehaviour: string | null
  mediendService: string | null
  overallExperience: string | null
  paymentQuery: string | null
  referralConfirmation: string | null
  referralName: string | null
  referralContact: string | null
  opdStatus: string | null
  opdMode: string | null
  additionalRemark: string | null

  satisfaction: SatisfactionLevel | null
  concernCategories: ConcernCategory[]
}

export interface ComplianceCallsFilters {
  status?: ComplianceCallStatus | null
  rating?: number | null
  startDate?: string | null
  endDate?: string | null
  caseStart?: string | null
  caseEnd?: string | null
  q?: string | null
  hospitalName?: string | null
  surgeonName?: string | null
  bdId?: string | null
  sort?: ComplianceCallSort
}

export interface ComplianceFilterOptions {
  hospitals: string[]
  surgeons: string[]
  bds: { id: string; name: string }[]
}

export interface ComplianceStats {
  byRating: Record<"1" | "2" | "3" | "4" | "5", number>
  pending: number
  totalCompleted: number
  averageRating: number | null
  dischargesThisMonth: number
  dischargesToday: number
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
  if (filters.caseStart) params.set("caseStart", filters.caseStart)
  if (filters.caseEnd) params.set("caseEnd", filters.caseEnd)
  if (filters.q) params.set("q", filters.q)
  if (filters.hospitalName) params.set("hospitalName", filters.hospitalName)
  if (filters.surgeonName) params.set("surgeonName", filters.surgeonName)
  if (filters.bdId) params.set("bdId", filters.bdId)
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

  problemDuringSurgery?: string | null
  problemAfterSurgery?: string | null
  commitmentStatus?: string | null
  concernResolved?: string | null
  doctorBehaviour?: string | null
  hospitalStaffBehaviour?: string | null
  bdmBehaviour?: string | null
  mediendService?: string | null
  overallExperience?: string | null
  paymentQuery?: string | null
  referralConfirmation?: string | null
  referralName?: string | null
  referralContact?: string | null
  opdStatus?: string | null
  opdMode?: string | null
  additionalRemark?: string | null

  satisfaction?: SatisfactionLevel | null
  concernCategories?: ConcernCategory[]
}

export function useUpdateComplianceCall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateComplianceCallInput) =>
      apiPatch<ComplianceCall>(`/api/compliance/calls/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance", "calls"] })
      qc.invalidateQueries({ queryKey: ["compliance", "stats"] })
      qc.invalidateQueries({ queryKey: ["compliance", "monthly-report"] })
    },
  })
}

export function useComplianceCall(id: string | null) {
  return useQuery<ComplianceCall>({
    queryKey: ["compliance", "calls", "detail", id],
    queryFn: () => apiGet<ComplianceCall>(`/api/compliance/calls/${id}`),
    enabled: !!id,
  })
}

export function useComplianceFilterOptions() {
  return useQuery<ComplianceFilterOptions>({
    queryKey: ["compliance", "filter-options"],
    queryFn: () => apiGet<ComplianceFilterOptions>("/api/compliance/filter-options"),
    staleTime: 5 * 60 * 1000, // 5 min — these change rarely
  })
}
