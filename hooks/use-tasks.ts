import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
} from "@/lib/api-client"

export interface Task {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  priority: string
  status: string
  assigneeId: string
  createdById: string
  projectId?: string | null
  startTime: string | null
  endTime: string | null
  allDay: boolean
  createdAt: string
  updatedAt: string
  completedById?: string | null
  completedAt?: string | null
  grade?: string | null
  completionComments?: string | null
  rejectionCount?: number
  assignee?: { id: string; name: string; email: string }
  createdBy?: { id: string; name: string }
  completedBy?: { id: string; name: string } | null
  project?: { id: string; name: string } | null
  approvals?: { id: string; oldDueDate: string | null; newDueDate: string | null; reason: string; status: string; createdAt: string; requestedBy: { id: string; name: string } }[]
  _count?: { approvals: number }
  unseenActivityCount?: number
  pendingApprovalCount?: number
}

export interface TasksQueryParams {
  assigneeId?: string
  createdById?: string
  status?: string
  startDate?: string
  endDate?: string
}

export interface TaskProject {
  id: string
  name: string
  createdById?: string
  createdAt?: string
  _count?: { tasks: number }
}

export interface TaskComment {
  id: string
  taskId: string
  userId: string
  content: string
  parentId?: string | null
  createdAt: string
  user: { id: string; name: string; email: string }
  parent?: { id: string; userId: string; user: { id: string; name: string } } | null
  replies?: TaskComment[]
}

export interface TaskActivityLog {
  id: string
  taskId: string
  userId: string
  action: string
  details: string | null
  createdAt: string
  user: { id: string; name: string }
}

export interface TaskStats {
  total: number
  completed: number
  pending: number
  pendingReview: number
  overdue: number
  employeesWithWarnings: number
  projectWise: { projectId: string | null; projectName: string; count: number }[]
  employeeWise: { assigneeId: string; assigneeName: string; total: number; completed: number; avgRating: number | null }[]
}

export function useTasks(
  params?: TasksQueryParams,
  options?: { enabled?: boolean }
) {
  const searchParams = new URLSearchParams()
  if (params?.assigneeId) searchParams.set("assigneeId", params.assigneeId)
  if (params?.createdById) searchParams.set("createdById", params.createdById)
  if (params?.status) searchParams.set("status", params.status)
  if (params?.startDate) searchParams.set("startDate", params.startDate)
  if (params?.endDate) searchParams.set("endDate", params.endDate)

  const queryString = searchParams.toString()

  return useQuery<Task[]>({
    queryKey: ["tasks", params?.assigneeId, params?.createdById, params?.status, params?.startDate, params?.endDate],
    queryFn: () =>
      apiGet<Task[]>(`/api/tasks${queryString ? `?${queryString}` : ""}`),
    enabled: options?.enabled !== false,
  })
}

export function useTask(id: string | null) {
  return useQuery<Task>({
    queryKey: ["tasks", id],
    queryFn: () => apiGet<Task>(`/api/tasks/${id}`),
    enabled: !!id,
  })
}

export function useMarkTaskSeen() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => apiPost<{ ok: boolean }>(`/api/tasks/${taskId}/seen`, {}),
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["tasks", taskId] })
      queryClient.invalidateQueries({ queryKey: ["badge-counts"] })
      queryClient.invalidateQueries({ queryKey: ["md-team-overview"] })
    },
  })
}

export function usePendingTasks(assigneeId?: string) {
  const queryString = assigneeId ? `?assigneeId=${assigneeId}` : ""
  return useQuery<Task[]>({
    queryKey: ["tasks", "pending", assigneeId],
    queryFn: () => apiGet<Task[]>(`/api/tasks/pending${queryString}`),
  })
}

export interface CreateTaskInput {
  title: string
  description?: string | null
  dueDate?: string | null
  priority?: "GENERAL" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  assigneeId?: string
  projectId?: string | null
  startTime?: string | null
  endTime?: string | null
  allDay?: boolean
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateTaskInput) => apiPost<Task>("/api/tasks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["md-team-overview"] })
      queryClient.invalidateQueries({ queryKey: ["badge-counts"] })
    },
  })
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  dueDate?: string | null
  /** Required when requesting a due date change (employee flow). */
  dueDateChangeReason?: string
  priority?: "GENERAL" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  status?: "PENDING" | "IN_PROGRESS" | "EMPLOYEE_DONE" | "COMPLETED" | "CANCELLED"
  /** Required when setting status to COMPLETED. 1-5 numeric rating. */
  grade?: "1" | "2" | "3" | "4" | "5"
  completionComments?: string | null
  assigneeId?: string
  projectId?: string | null
  startTime?: string | null
  endTime?: string | null
  allDay?: boolean
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: UpdateTaskInput
    }) => apiPatch<Task>(`/api/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["badge-counts"] })
      queryClient.invalidateQueries({ queryKey: ["tasks", "stats"] })
      queryClient.invalidateQueries({ queryKey: ["tasks", "performance"] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["badge-counts"] })
    },
  })
}

export interface TaskDueDateApproval {
  id: string
  taskId: string
  requestedById: string
  oldDueDate: string | null
  newDueDate: string | null
  reason: string
  status: string
  createdAt: string
  task: {
    id: string
    title: string
    assignee: { id: string; name: string; email: string }
  }
  requestedBy: { id: string; name: string; email: string }
}

export function useTaskApprovals() {
  return useQuery<TaskDueDateApproval[]>({
    queryKey: ["task-approvals"],
    queryFn: () => apiGet<TaskDueDateApproval[]>("/api/task-approvals"),
  })
}

export function useApproveTaskDueDate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string
      status: "APPROVED" | "REJECTED"
    }) =>
      apiPatch<{ status: string }>(`/api/task-approvals/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-approvals"] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["badge-counts"] })
    },
  })
}

export type UpdateTaskDueDateResult =
  | Task
  | { message: string; approvalId: string }

export function useUpdateTaskDueDate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, dueDate }: { id: string; dueDate: string }) =>
      apiPatch<UpdateTaskDueDateResult>(`/api/tasks/${id}`, { dueDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["badge-counts"] })
    },
  })
}

export function useTaskProjects() {
  return useQuery<TaskProject[]>({
    queryKey: ["task-projects"],
    queryFn: () => apiGet<TaskProject[]>("/api/task-projects"),
  })
}

export function useCreateTaskProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) =>
      apiPost<TaskProject>("/api/task-projects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-projects"] })
    },
  })
}

export function useTaskComments(taskId: string | null) {
  return useQuery<TaskComment[]>({
    queryKey: ["tasks", taskId, "comments"],
    queryFn: () => apiGet<TaskComment[]>(`/api/tasks/${taskId}/comments`),
    enabled: !!taskId,
  })
}

export function useCreateTaskComment(taskId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { content: string; parentId?: string }) =>
      apiPost<TaskComment>(`/api/tasks/${taskId}/comments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "comments"] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

export function useTaskActivity(taskId: string | null) {
  return useQuery<TaskActivityLog[]>({
    queryKey: ["tasks", taskId, "activity"],
    queryFn: () => apiGet<TaskActivityLog[]>(`/api/tasks/${taskId}/activity`),
    enabled: !!taskId,
  })
}

export function useTaskStats() {
  return useQuery<TaskStats>({
    queryKey: ["tasks", "stats"],
    queryFn: () => apiGet<TaskStats>("/api/tasks/stats"),
  })
}

export interface PerformanceData {
  month: number
  teamStats: {
    totalRatings: number
    avgRating: number | null
    completedCount: number
    rejectedCount: number
  }
  employees: {
    employeeId: string
    employeeName: string
    avgRating: number | null
    totalRatings: number
    completedCount: number
    rejectedCount: number
    ratingDistribution: { 1: number; 2: number; 3: number; 4: number; 5: number }
    ratings: { grade: number; action: string; taskTitle: string; comments: string | null; createdAt: Date }[]
  }[]
}

export function usePerformanceData(month: number) {
  return useQuery<PerformanceData>({
    queryKey: ["tasks", "performance", month],
    queryFn: () => apiGet<PerformanceData>(`/api/tasks/performance?month=${month}`),
  })
}

export function useSubordinateTasks() {
  return useQuery<Task[]>({
    queryKey: ["tasks", "subordinates"],
    queryFn: () => apiGet<Task[]>("/api/tasks/subordinates"),
  })
}

export interface AssignableUser {
  id: string
  name: string
  email: string
}

export function useAssignableUsers() {
  return useQuery<AssignableUser[]>({
    queryKey: ["tasks", "assignable-users"],
    queryFn: () => apiGet<AssignableUser[]>("/api/tasks/assignable-users"),
  })
}

export type WarningType = "REPEATED_DEADLINE_MISS" | "LOW_QUALITY_WORK" | "UNRESPONSIVE" | "TASK_ABANDONMENT" | "OTHER"

export interface Warning {
  id: string
  employeeId: string
  taskId: string | null
  type: WarningType
  note: string
  issuedById: string
  createdAt: string
  employee?: { id: string; name: string; email: string }
  task?: { id: string; title: string } | null
  issuedBy?: { id: string; name: string }
}

export interface WarningSuggestion {
  type: "OVERDUE_3_DAYS" | "REJECTED_MULTIPLE" | "GRADE_C"
  taskId: string
  taskTitle: string
  employeeId: string
  employeeName: string
  reason: string
}

export function useWarnings() {
  return useQuery<Warning[]>({
    queryKey: ["warnings"],
    queryFn: () => apiGet<Warning[]>("/api/warnings"),
  })
}

export function useCreateWarning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { employeeId: string; taskId?: string | null; type: WarningType; note: string }) =>
      apiPost<Warning>("/api/warnings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warnings"] })
      queryClient.invalidateQueries({ queryKey: ["tasks", "stats"] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

export function useWarningSuggestions() {
  return useQuery<WarningSuggestion[]>({
    queryKey: ["warnings", "suggestions"],
    queryFn: () => apiGet<WarningSuggestion[]>("/api/warnings/suggestions"),
  })
}
