'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useState } from 'react'
import type { User } from '@/generated/prisma/client'
import { Plus, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Progress } from '@/components/ui/progress'

interface Target {
  id: string
  targetType: 'BD' | 'TEAM'
  targetForId: string
  periodType: 'WEEK' | 'MONTH'
  periodStartDate: string
  periodEndDate: string
  metric: 'LEADS_CLOSED' | 'NET_PROFIT' | 'BILL_AMOUNT' | 'SURGERIES_DONE'
  targetValue: number
  createdBy: { id: string; name: string }
  bonusRules: Array<{
    id: string
    ruleType: 'PERCENT_ABOVE_TARGET' | 'FIXED_COUNT'
    thresholdValue: number
    bonusAmount?: number
    bonusPercentage?: number
  }>
  progress?: {
    actual: number
    percentage: number
    status: 'on_track' | 'at_risk' | 'completed'
  }
}

interface ManagerEmployee {
  id: string
  employeeCode: string
  user: { id: string; name: string; role: string }
}

export default function TargetsPage() {
  const [activeTab, setActiveTab] = useState<'team' | 'bd'>('team')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: targets, isLoading } = useQuery<Target[]>({
    queryKey: ['targets', activeTab],
    queryFn: () => apiGet<Target[]>(`/api/targets?targetType=${activeTab.toUpperCase()}`),
  })

  const { data: managers } = useQuery<ManagerEmployee[]>({
    queryKey: ['employees', 'managers'],
    queryFn: () => apiGet<ManagerEmployee[]>('/api/employees?role=TEAM_LEAD&includeManagers=true'),
  })

  const { data: users } = useQuery<User[]>({
    queryKey: ['users', 'BD'],
    queryFn: () => apiGet<User[]>('/api/users?role=BD'),
  })

  const createTargetMutation = useMutation({
    mutationFn: (data: Partial<Target>) => apiPost('/api/targets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      setIsDialogOpen(false)
      toast.success('Target created successfully')
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message || 'Failed to create target')
      } else {
        toast.error('Failed to create target')
      }
    },
  })

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Targets & Bonuses</h1>
              <p className="text-muted-foreground mt-1">Manage targets and bonus rules</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Target
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Target</DialogTitle>
                  <DialogDescription>Set targets for manager groups or individual BDs</DialogDescription>
                </DialogHeader>
                <CreateTargetForm
                  managers={managers || []}
                  users={users || []}
                  targetType={activeTab}
                  onSubmit={(data) => createTargetMutation.mutate(data)}
                  isLoading={createTargetMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex gap-2 border-b">
            <button
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'team'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Team Targets
            </button>
            <button
              onClick={() => setActiveTab('bd')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'bd'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              BD Targets
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading targets...</div>
          ) : (
            <div className="grid gap-4">
              {targets?.map((target) => (
                <TargetCard key={target.id} target={target} />
              ))}
              {(!targets || targets.length === 0) && (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No targets found. Create your first target to get started.
                  </CardContent>
                </Card>
              )}
            </div>
          )}
      </div>
    </AuthenticatedLayout>
  )
}

function TargetCard({ target }: { target: Target }) {
  const progress = target.progress || { actual: 0, percentage: 0, status: 'on_track' as const }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {target.targetType === 'TEAM' ? 'Team Target' : 'BD Target'}
            </CardTitle>
            <CardDescription>
              {target.metric.replace('_', ' ')} • {target.periodType} •{' '}
              {new Date(target.periodStartDate).toLocaleDateString()} -{' '}
              {new Date(target.periodEndDate).toLocaleDateString()}
            </CardDescription>
          </div>
          <Badge variant={progress.status === 'completed' ? 'default' : 'secondary'}>
            {progress.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">
              {progress.actual.toLocaleString()} / {target.targetValue.toLocaleString()}
            </span>
          </div>
          <Progress value={Math.min(progress.percentage, 100)} className="h-2" />
        </div>

        {target.bonusRules.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Bonus Rules</p>
            <div className="space-y-1">
              {target.bonusRules.map((rule) => (
                <div key={rule.id} className="text-sm text-muted-foreground">
                  • {rule.ruleType === 'PERCENT_ABOVE_TARGET' ? `${rule.thresholdValue}% above target` : `${rule.thresholdValue} ${target.metric.replace('_', ' ')}`}
                  {rule.bonusAmount && ` → ₹${rule.bonusAmount.toLocaleString()}`}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CreateTargetForm({
  managers,
  users,
  targetType,
  onSubmit,
  isLoading,
}: {
  managers: ManagerEmployee[]
  users: User[]
  targetType: 'team' | 'bd'
  onSubmit: (data: Partial<Target>) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    targetForId: '',
    periodType: 'MONTH' as 'WEEK' | 'MONTH',
    periodStartDate: '',
    periodEndDate: '',
    metric: 'SURGERIES_DONE' as 'LEADS_CLOSED' | 'NET_PROFIT' | 'BILL_AMOUNT' | 'SURGERIES_DONE',
    targetValue: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      targetType: targetType.toUpperCase() as 'BD' | 'TEAM',
      ...formData,
      targetValue: parseFloat(formData.targetValue),
      periodStartDate: new Date(formData.periodStartDate).toISOString(),
      periodEndDate: new Date(formData.periodEndDate).toISOString(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>{targetType === 'team' ? 'Manager (Team)' : 'BD'}</Label>
        <Select
          value={formData.targetForId}
          onValueChange={(value) => setFormData({ ...formData, targetForId: value })}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${targetType === 'team' ? 'manager' : 'BD'}`} />
          </SelectTrigger>
          <SelectContent>
            {targetType === 'team'
              ? managers.map((mgr) => (
                  <SelectItem key={mgr.id} value={mgr.id}>
                    {mgr.user.name} ({mgr.employeeCode})
                  </SelectItem>
                ))
              : users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Period Type</Label>
          <Select
            value={formData.periodType}
            onValueChange={(value: 'WEEK' | 'MONTH') =>
              setFormData({ ...formData, periodType: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WEEK">Week</SelectItem>
              <SelectItem value="MONTH">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Metric</Label>
          <Select
            value={formData.metric}
            onValueChange={(value) => setFormData({ ...formData, metric: value as Target['metric'] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SURGERIES_DONE">Surgeries Done</SelectItem>
              <SelectItem value="LEADS_CLOSED">Leads Closed</SelectItem>
              <SelectItem value="NET_PROFIT">Net Profit</SelectItem>
              <SelectItem value="BILL_AMOUNT">Bill Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Start Date</Label>
          <Input
            type="date"
            value={formData.periodStartDate}
            onChange={(e) => setFormData({ ...formData, periodStartDate: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>End Date</Label>
          <Input
            type="date"
            value={formData.periodEndDate}
            onChange={(e) => setFormData({ ...formData, periodEndDate: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <Label>Target Value</Label>
        <Input
          type="number"
          value={formData.targetValue}
          onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
          placeholder="Enter target value"
          required
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Target'}
        </Button>
      </div>
    </form>
  )
}

