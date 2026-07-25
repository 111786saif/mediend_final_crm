'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Building2, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

const ROLES = [
  { value: 'MD', label: 'MD' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'IT_HEAD', label: 'IT Head' },
  { value: 'HR_HEAD', label: 'HR Head' },
  { value: 'FINANCE_HEAD', label: 'Finance Head' },
  { value: 'SALES_HEAD', label: 'Sales Head' },
  { value: 'INSURANCE_HEAD', label: 'Insurance Head' },
  { value: 'PL_HEAD', label: 'PL Head' },
  { value: 'OUTSTANDING_HEAD', label: 'Outstanding Head' },
  { value: 'DIGITAL_MARKETING_HEAD', label: 'Digital Marketing Head' },
  { value: 'CATEGORY_MANAGER', label: 'Category Manager' },
  { value: 'ASSISTANT_CATEGORY_MANAGER', label: 'Assistant Category Manager' },
  { value: 'LOAN_DEMAT_HEAD', label: 'Loan Demat Head' },
  { value: 'COMPLIANCE_HEAD', label: 'Compliance Head' },
  { value: 'ACCESS_MATRIX', label: 'Access Matrix' },
  { value: 'EXECUTIVE_ASSISTANT', label: 'Executive Assistant' },
  { value: 'TEAM_LEAD', label: 'Team Lead' },
  { value: 'BD', label: 'BD' },
  { value: 'USER', label: 'User' },
  { value: 'TESTER', label: 'Tester' },
]

interface UserInList {
  id: string
  name: string
  email: string
  role: string
  employee?: {
    department?: { id: string; name: string } | null
  } | null
}

interface UserDirectoryTableProps {
  search: string
  setSearch: (s: string) => void
  roleFilter: string
  setRoleFilter: (r: string) => void
  isLoading: boolean
  currentPage: number
  setCurrentPage: (p: number) => void
  totalPages: number
  paginatedUsers: UserInList[]
  onManagePermissions: (userId: string) => void
  getInitials: (name: string) => string
  getAvatarGradient: (userId: string) => { bg: string; border: string }
  totalUsers: number
  itemsPerPage: number
}

export function UserDirectoryTable({
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  isLoading,
  currentPage,
  setCurrentPage,
  totalPages,
  paginatedUsers,
  onManagePermissions,
  getInitials,
  getAvatarGradient,
  totalUsers,
  itemsPerPage,
}: UserDirectoryTableProps) {
  return (
    <Card className="border border-border bg-card text-card-foreground shadow-sm">
      <CardContent className="space-y-4 pt-5">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search directory by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-12 bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring text-sm"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[240px] h-12 bg-background border-border text-foreground text-sm">
              <SelectValue placeholder="Filter by Role" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="all">All Roles</SelectItem>
              {ROLES.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Directory Table */}
        <div className="rounded-xl border border-border overflow-hidden bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50 border-b border-border">
              <TableRow className="border-b border-border">
                <TableHead className="text-muted-foreground font-semibold px-6 py-4">User Profile</TableHead>
                <TableHead className="text-muted-foreground font-semibold px-6 py-4">Role</TableHead>
                <TableHead className="text-muted-foreground font-semibold px-6 py-4">Department</TableHead>
                <TableHead className="text-muted-foreground font-semibold px-6 py-4">Status</TableHead>
                <TableHead className="text-muted-foreground font-semibold px-6 py-4 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground border-b border-border">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-cyan-600 dark:border-cyan-400 border-r-transparent"></div>
                    <p className="mt-2 text-sm">Loading directory database...</p>
                  </TableCell>
                </TableRow>
              ) : paginatedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground border-b border-border">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm">No users found matching search query.</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((u) => (
                  <TableRow key={u.id} className="border-b border-border hover:bg-muted/40 transition-colors group">
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br ${getAvatarGradient(u.id).bg} border font-bold text-sm`}>
                          {getInitials(u.name)}
                        </div>
                        <div>
                          <div className="font-bold text-foreground group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div className="font-semibold text-foreground">{u.role}</div>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div className="text-sm text-cyan-600 dark:text-cyan-400 font-medium flex items-center gap-1.5 mt-0.5">
                        {u.employee?.department?.name ? (
                          <>
                            <Building2 className="h-3.5 w-3.5" />
                            {u.employee.department.name}
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                        Active
                      </span>
                    </TableCell>
                    <TableCell className="py-4 px-6 text-center">
                      <Button
                        variant="outline"
                        onClick={() => onManagePermissions(u.id)}
                        className="border-border hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors text-sm font-semibold bg-background hover:bg-muted text-foreground px-5 py-2 h-10"
                      >
                        Manage Permissions
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalUsers)} of {totalUsers} users
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                className="h-8 w-8 border-border bg-background text-foreground hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }).map((_, idx) => (
                <Button
                  key={idx}
                  variant={currentPage === idx + 1 ? 'default' : 'outline'}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`h-8 w-8 text-xs ${currentPage === idx + 1 ? 'bg-primary text-primary-foreground hover:bg-primary' : 'border-border bg-background text-foreground hover:bg-muted'}`}
                >
                  {idx + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                className="h-8 w-8 border-border bg-background text-foreground hover:bg-muted"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
