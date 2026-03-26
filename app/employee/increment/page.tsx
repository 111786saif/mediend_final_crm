'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useState } from 'react'
import { TrendingUp, Clock, CheckCircle, XCircle, AlertCircle, Send, FileText, Link } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface IncrementRequest {
  id: string
  currentSalary: number
  requestedAmount: number | null
  reason: string
  achievements: string | null
  documents: string[] | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approvalPercentage: number | null
  hrRemarks: string | null
  createdAt: string
}

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
  APPROVED: { label: 'Approved', variant: 'default' as const, icon: CheckCircle },
  REJECTED: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle },
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export default function EmployeeIncrementPage() {
  const [reason, setReason] = useState('')
  const [achievements, setAchievements] = useState('')
  const [requestedAmount, setRequestedAmount] = useState('')
  const [documents, setDocuments] = useState<string[]>([])
  const [newDocUrl, setNewDocUrl] = useState('')
  const queryClient = useQueryClient()

  const { data: requests, isLoading } = useQuery<IncrementRequest[]>({
    queryKey: ['my-increments'],
    queryFn: () => apiGet<IncrementRequest[]>('/api/employee/increment'),
  })

  const submitMutation = useMutation({
    mutationFn: (data: {
      reason: string
      achievements?: string
      requestedAmount?: number
      documents?: string[]
    }) => apiPost<IncrementRequest>('/api/employee/increment', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-increments'] })
      setReason('')
      setAchievements('')
      setRequestedAmount('')
      setDocuments([])
      toast.success('Increment request submitted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit request')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 15) {
      toast.error('Please provide a detailed reason (at least 15 characters)')
      return
    }
    submitMutation.mutate({
      reason,
      achievements: achievements || undefined,
      requestedAmount: requestedAmount ? parseFloat(requestedAmount) : undefined,
      documents: documents.length > 0 ? documents : undefined,
    })
  }

  const addDocument = () => {
    if (newDocUrl && documents.length < 5) {
      try {
        new URL(newDocUrl)
        setDocuments([...documents, newDocUrl])
        setNewDocUrl('')
      } catch {
        toast.error('Please enter a valid URL')
      }
    }
  }

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index))
  }

  const hasPendingRequest = requests?.some((r) => r.status === 'PENDING')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Apply for Increment</h1>
        <p className="text-muted-foreground mt-1">Submit your increment request with supporting documents</p>
      </div>

      {/* Application Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Increment Application
          </CardTitle>
          <CardDescription>
            Provide details about your work and achievements to support your request
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasPendingRequest ? (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <p className="text-amber-700">
                You have a pending increment request. Please wait for a response before submitting a new one.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="reason">Reason for Increment Request *</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe why you deserve an increment, your contributions, and value to the organization..."
                  rows={5}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum 15 characters ({reason.length}/15)
                </p>  
              </div>

              <div>
                <Label htmlFor="achievements">Key Achievements (Optional)</Label>
                <Textarea
                  id="achievements"
                  value={achievements}
                  onChange={(e) => setAchievements(e.target.value)}
                  placeholder="List your major achievements, projects completed, targets exceeded..."
                  rows={4}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="requestedAmount">Requested Amount (Optional)</Label>
                <Input
                  id="requestedAmount"
                  type="number"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  placeholder="Expected increment amount (annual)"
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty if you prefer HR to decide
                </p>
              </div>

              <div>
                <Label>Supporting Documents (Optional, max 5)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newDocUrl}
                    onChange={(e) => setNewDocUrl(e.target.value)}
                    placeholder="Enter document URL"
                    disabled={documents.length >= 5}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addDocument}
                    disabled={documents.length >= 5 || !newDocUrl}
                  >
                    Add
                  </Button>
                </div>
                {documents.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {documents.map((doc, index) => (
                      <div key={index} className="flex items-center gap-2 bg-muted/50 p-2 rounded">
                        <Link className="h-4 w-4" />
                        <span className="text-sm flex-1 truncate">{doc}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDocument(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" disabled={submitMutation.isPending || reason.length < 50}>
                <Send className="h-4 w-4 mr-2" />
                {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Request History */}
      <Card>
        <CardHeader>
          <CardTitle>My Increment Requests</CardTitle>
          <CardDescription>Track the status of your increment applications</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : requests && requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((request) => {
                const statusConfig = STATUS_CONFIG[request.status]
                const StatusIcon = statusConfig.icon
                return (
                  <div key={request.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Submitted on {format(new Date(request.createdAt), 'PPP')}
                        </p>
                        <p className="text-sm mt-1">
                          Current Salary: <strong>{formatCurrency(request.currentSalary)}</strong>
                        </p>
                        {request.requestedAmount && (
                          <p className="text-sm">
                            Requested: <strong>{formatCurrency(request.requestedAmount)}</strong>
                          </p>
                        )}
                      </div>
                      <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </div>

                    <p className="font-medium mb-1">Reason:</p>
                    <p className="text-sm bg-muted/50 p-3 rounded mb-3">{request.reason}</p>

                    {request.achievements && (
                      <div className="mb-3">
                        <p className="font-medium mb-1">Achievements:</p>
                        <p className="text-sm bg-muted/50 p-3 rounded">{request.achievements}</p>
                      </div>
                    )}

                    {request.documents && request.documents.length > 0 && (
                      <div className="mb-3">
                        <p className="font-medium mb-1 flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          Attached Documents:
                        </p>
                        <div className="space-y-1">
                          {request.documents.map((doc, i) => (
                            <a
                              key={i}
                              href={doc}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline block"
                            >
                              Document {i + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {request.status === 'APPROVED' && request.approvalPercentage && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded">
                        <p className="text-sm font-medium text-green-700">
                          Approved Increment: {request.approvalPercentage}%
                        </p>
                        {request.hrRemarks && (
                          <p className="text-sm text-green-600 mt-1">{request.hrRemarks}</p>
                        )}
                      </div>
                    )}

                    {request.status === 'REJECTED' && request.hrRemarks && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm font-medium text-red-700">HR Remarks:</p>
                        <p className="text-sm text-red-600">{request.hrRemarks}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No increment requests yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

