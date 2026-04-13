"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search } from "lucide-react"
import { apiGet, apiPost } from "@/lib/api-client"
import { useMDTeamOverview } from "@/hooks/use-md-team"
import { toast } from "sonner"

interface EmployeeOption {
  id: string
  employeeCode: string
  user: { id: string; name: string | null; email: string | null; role: string }
  department: { id: string; name: string } | null
}

interface AddPersonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded?: () => void
}

export function AddPersonDialog({ open, onOpenChange, onAdded }: AddPersonDialogProps) {
  const [search, setSearch] = useState("")
  const queryClient = useQueryClient()
  const { data: teamData } = useMDTeamOverview()
  const existingEmployeeIds = new Set((teamData?.members ?? []).map((m) => m.employeeId))

  const { data: employees = [], isLoading } = useQuery<EmployeeOption[]>({
    queryKey: ["employees", "list", search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search.trim()) params.set("search", search.trim())
      return apiGet<EmployeeOption[]>(`/api/employees?${params.toString()}`)
    },
    enabled: open,
  })

  const addMutation = useMutation({
    mutationFn: (employeeIds: string[]) =>
      apiPost<{ message: string }>("/api/md/watchlist", { employeeIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["md-team-overview"] })
      onAdded?.()
      toast.success("Added to team")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to add")
    },
  })

  const toAdd = employees.filter((e) => !existingEmployeeIds.has(e.id))

  const handleAdd = (employeeId: string) => {
    addMutation.mutate([employeeId])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to team</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-[280px] rounded-md border">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : toAdd.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {employees.length === 0
                  ? "No employees found."
                  : "Everyone in this list is already on your team."}
              </div>
            ) : (
              <ul className="p-2 space-y-1">
                {toAdd.map((emp) => (
                  <li
                    key={emp.id}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {emp.user.name ?? emp.employeeCode}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {emp.user.email ?? emp.department?.name ?? "—"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAdd(emp.id)}
                      disabled={addMutation.isPending}
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
