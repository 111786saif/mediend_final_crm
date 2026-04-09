'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useState, useMemo, useEffect } from 'react'
import { FileText, Plus, ExternalLink, Mail, Upload, Search, ChevronRight, Check, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
interface Employee {
  id: string
  employeeCode: string
  user: {
    id: string
    name: string
    email: string
  } | null
  department?: {
    id: string
    name: string
  } | null
}

interface EmployeeDocument {
  id: string
  employeeId: string | null
  documentType: 'OFFER_LETTER' | 'INCREMENT_LETTER' | 'EXPERIENCE_LETTER' | 'RELIEVING_LETTER' | 'INTERNSHIP_OFFER_LETTER' | 'INTERNSHIP_COMPLETION_LETTER' | 'CUSTOM'
  documentUrl?: string | null
  title?: string | null
  applicantName?: string | null
  applicantEmail?: string | null
  generatedAt: string
  metadata: Record<string, unknown>
  ackToken?: string | null
  acknowledgedAt?: string | null
  employee: {
    employeeCode: string
    user: {
      name: string
      email: string
    }
  } | null
}

const DOCUMENT_TYPES: Record<string, string> = {
  OFFER_LETTER: 'Offer Letter',
  INCREMENT_LETTER: 'Increment Letter',
  EXPERIENCE_LETTER: 'Experience Letter',
  RELIEVING_LETTER: 'Relieving Letter',
  INTERNSHIP_OFFER_LETTER: 'Internship Offer',
  INTERNSHIP_COMPLETION_LETTER: 'Internship Completion',
  CUSTOM: 'Custom',
}

function getDocumentLabel(doc: EmployeeDocument): string {
  if (doc.documentType === 'CUSTOM' && doc.title) return doc.title
  return DOCUMENT_TYPES[doc.documentType] ?? doc.documentType
}

const DOC_TYPES_FOR_TABLE = ['OFFER_LETTER', 'INCREMENT_LETTER', 'EXPERIENCE_LETTER', 'RELIEVING_LETTER', 'INTERNSHIP_OFFER_LETTER', 'INTERNSHIP_COMPLETION_LETTER', 'CUSTOM'] as const

function DocStatusCell({ docs }: { docs: EmployeeDocument[] }) {
  if (docs.length === 0) return <span className="text-muted-foreground/50">—</span>
  const hasAck = docs.some((d) => d.acknowledgedAt)
  const hasPending = docs.some((d) => d.ackToken && !d.acknowledgedAt)
  if (hasAck) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400">
        <Check className="h-3 w-3" />
        {docs.length}
      </span>
    )
  }
  if (hasPending) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-400">
        <Clock className="h-3 w-3" />
        {docs.length}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-400">
      <FileText className="h-3 w-3" />
      {docs.length}
    </span>
  )
}

export default function HRDocumentsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [sheetEmployee, setSheetEmployee] = useState<Employee | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => apiGet<Employee[]>('/api/employees'),
  })

  const { data: documents = [], isLoading } = useQuery<EmployeeDocument[]>({
    queryKey: ['hr-documents'],
    queryFn: () => apiGet<EmployeeDocument[]>('/api/hr/documents'),
  })

  const { data: employeeDocs = [], isLoading: docsLoading } = useQuery<EmployeeDocument[]>({
    queryKey: ['hr-documents', sheetEmployee?.id],
    queryFn: () => apiGet<EmployeeDocument[]>(`/api/hr/documents?employeeId=${sheetEmployee!.id}`),
    enabled: !!sheetEmployee?.id,
  })

  const documentsByEmployee = useMemo(() => {
    const map = new Map<string, EmployeeDocument[]>()
    for (const doc of documents) {
      if (!doc.employeeId) continue
      const list = map.get(doc.employeeId) ?? []
      list.push(doc)
      map.set(doc.employeeId, list)
    }
    return map
  }, [documents])

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees
    const q = searchQuery.toLowerCase()
    return employees.filter(
      (e) =>
        e.user?.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.department?.name?.toLowerCase().includes(q)
    )
  }, [employees, searchQuery])

  const generateMutation = useMutation({
    mutationFn: async (data: {
      employeeId?: string
      documentType: string
      applicantName?: string
      applicantEmail?: string
      metadata?: Record<string, unknown>
    }) => {
      const response = await apiPost<{ document: EmployeeDocument; htmlContent: string }>('/api/hr/documents', data)
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hr-documents'] })
      setIsDialogOpen(false)
      toast.success('Document generated successfully')
      window.open(`/hr/documents/${data.document.id}/view`, '_blank', 'noopener,noreferrer')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate document')
    },
  })

  const handleViewDocument = (docId: string) => {
    window.open(`/hr/documents/${docId}/view`, '_blank', 'noopener,noreferrer')
  }

  const invalidateDocuments = () => {
    queryClient.invalidateQueries({ queryKey: ['hr-documents'] })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Document Generation</h1>
          <p className="text-muted-foreground mt-1">Generate and manage employee documents</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Generate Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Generate Employee Document</DialogTitle>
              <DialogDescription>Select an employee and document type to generate</DialogDescription>
            </DialogHeader>
            <GenerateDocumentForm
              employees={employees}
              preselectedEmployeeId={sheetEmployee?.id}
              onSubmit={(data) => generateMutation.mutate(data)}
              isLoading={generateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Document Types Overview */}
      <div className="grid gap-4 md:grid-cols-5">
        {DOC_TYPES_FOR_TABLE.map((key) => {
          const count = documents.filter((d) => d.documentType === key).length
          const ackCount = documents.filter((d) => d.documentType === key && d.acknowledgedAt).length
          const label = DOCUMENT_TYPES[key]
          return (
            <Card key={key} className="border-l-4 border-l-primary/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground">
                  {ackCount > 0 ? `${ackCount} acknowledged` : 'Documents'}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
          <CardDescription>Click an employee to view and manage their documents. Green = acknowledged, Amber = pending, Blue = given</CardDescription>
          <div className="relative mt-2 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold">Employee</TableHead>
                    <TableHead className="font-semibold">Department</TableHead>
                    {DOC_TYPES_FOR_TABLE.map((key) => (
                      <TableHead key={key} className="text-center font-semibold whitespace-nowrap">
                        {DOCUMENT_TYPES[key]}
                      </TableHead>
                    ))}
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => {
                    const empDocs = documentsByEmployee.get(emp.id) ?? []
                    const docsByType = DOC_TYPES_FOR_TABLE.reduce(
                      (acc, type) => {
                        acc[type] = empDocs.filter((d) => d.documentType === type)
                        return acc
                      },
                      {} as Record<string, EmployeeDocument[]>
                    )
                    return (
                      <TableRow
                        key={emp.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSheetEmployee(emp)}
                      >
                        <TableCell className="font-medium">
                          <div>{emp.user?.name ?? '—'}</div>
                          <div className="text-sm text-muted-foreground">{emp.employeeCode}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{emp.department?.name ?? '—'}</TableCell>
                        {DOC_TYPES_FOR_TABLE.map((key) => (
                          <TableCell key={key} className="text-center">
                            <DocStatusCell docs={docsByType[key]} />
                          </TableCell>
                        ))}
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        {searchQuery ? 'No employees match your search' : 'No employees found'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Documents Sheet */}
      <Sheet open={!!sheetEmployee} onOpenChange={(open) => !open && setSheetEmployee(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto p-6">
          {sheetEmployee && (
            <>
              <SheetHeader>
                <SheetTitle>{sheetEmployee.user?.name ?? sheetEmployee.employeeCode}</SheetTitle>
                <SheetDescription>
                  {sheetEmployee.employeeCode}
                  {sheetEmployee.department?.name && ` • ${sheetEmployee.department.name}`}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsDialogOpen(true)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Generate Document
                  </Button>
                  <UploadDocumentButton employeeId={sheetEmployee.id} onSuccess={invalidateDocuments} />
                </div>
                <div className="pt-4 pb-2 px-1">
                  <h4 className="font-medium mb-3">Documents</h4>
                  {docsLoading ? (
                    <div className="text-sm text-muted-foreground py-4">Loading...</div>
                  ) : employeeDocs.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4 border rounded-lg border-dashed p-4 text-center">
                      No documents yet. Generate or upload a document.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeeDocs.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary">{getDocumentLabel(doc)}</Badge>
                                {doc.acknowledgedAt && (
                                  <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                                    Acknowledged {format(new Date(doc.acknowledgedAt), 'PP')}
                                  </Badge>
                                )}
                                {doc.ackToken && !doc.acknowledgedAt && (
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                    Pending
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(doc.generatedAt), 'PP')}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {doc.documentType === 'CUSTOM' ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    asChild
                                  >
                                    <a href={doc.documentUrl!} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4 mr-1" />
                                      Open
                                    </a>
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleViewDocument(doc.id)}
                                    >
                                      <ExternalLink className="h-4 w-4 mr-1" />
                                      View
                                    </Button>
                                    <EmailDocumentButton
                                      documentId={doc.id}
                                      defaultEmail={doc.employee?.user.email || doc.applicantEmail || ''}
                                      documentType={doc.documentType}
                                      onSuccess={invalidateDocuments}
                                    />
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function UploadDocumentButton({ employeeId, onSuccess }: { employeeId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const queryClient = useQueryClient()

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('employeeId', employeeId)
      if (title.trim()) formData.append('title', title.trim())

      const res = await fetch('/api/hr/documents/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      toast.success('Document uploaded')
      setOpen(false)
      setTitle('')
      setFile(null)
      queryClient.invalidateQueries({ queryKey: ['hr-documents'] })
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-1" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>Upload a PDF or image for this employee</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title (optional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Certificate, ID Proof"
            />
          </div>
          <div>
            <Label>File (PDF or image)</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EmailDocumentButton({
  documentId,
  defaultEmail,
  documentType,
  onSuccess,
}: {
  documentId: string
  defaultEmail: string
  documentType: string
  onSuccess?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(defaultEmail)
  const [sending, setSending] = useState(false)
  const queryClient = useQueryClient()

  const handleSend = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address')
      return
    }
    setSending(true)
    try {
      const res = await fetch(`/api/hr/documents/${documentId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      toast.success('Email sent')
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ['hr-documents'] })
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  const subjectLabel = DOCUMENT_TYPES[documentType] ?? documentType

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), o && setEmail(defaultEmail))}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="h-4 w-4 mr-1" />
          Email
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email {subjectLabel}</DialogTitle>
          <DialogDescription>Send this document to the recipient</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Recipient email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? 'Sending...' : 'Send Email'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GenerateDocumentForm({
  employees,
  preselectedEmployeeId,
  onSubmit,
  isLoading,
}: {
  employees: Employee[]
  preselectedEmployeeId?: string
  onSubmit: (data: { employeeId?: string; documentType: string; applicantName?: string; applicantEmail?: string; metadata?: Record<string, unknown> }) => void
  isLoading: boolean
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [formData, setFormData] = useState({
    documentType: '',
    employeeId: preselectedEmployeeId ?? '',
    applicantName: '',
    applicantEmail: '',
    designation: '',
    ctc: '',
    guardianName: '',
    guardianRelation: 'S/O',
    address: '',
    isSales: false,
    salesTarget: '',
    monthlyTarget: '',
    joiningDate: '',
    acceptanceDeadline: '',
    previousSalary: '',
    newSalary: '',
    incrementPercentage: '',
    effectiveDate: '',
    joinDate: '',
    lastWorkingDate: '',
    resignationDate: '',
    remarks: '',
    stipend: '',
    duration: '',
    internshipType: 'Full-time',
    location: '',
    startDate: '',
    endDate: '',
    department: '',
  })

  useEffect(() => {
    if (preselectedEmployeeId) {
      setFormData((prev) => ({ ...prev, employeeId: preselectedEmployeeId }))
    }
  }, [preselectedEmployeeId])

  const isOfferLetter = formData.documentType === 'OFFER_LETTER' || formData.documentType === 'INTERNSHIP_OFFER_LETTER'
  const selectedEmployee = employees.find((e) => e.id === formData.employeeId)
  const canProceed = formData.documentType && formData.employeeId

  const summaryLabel = selectedEmployee?.user?.name ?? selectedEmployee?.employeeCode

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const metadata: Record<string, unknown> = {}
    if (formData.designation) metadata.designation = formData.designation
    if (formData.ctc) metadata.ctc = parseFloat(formData.ctc)
    if (formData.guardianName) metadata.guardianName = formData.guardianName
    if (formData.guardianRelation) metadata.guardianRelation = formData.guardianRelation
    if (formData.address) metadata.address = formData.address
    if (formData.isSales) metadata.isSales = true
    if (formData.salesTarget) metadata.salesTarget = formData.salesTarget
    if (formData.monthlyTarget) metadata.monthlyTarget = formData.monthlyTarget
    if (formData.joiningDate) metadata.joiningDate = formData.joiningDate
    if (formData.acceptanceDeadline) metadata.acceptanceDeadline = formData.acceptanceDeadline
    if (formData.previousSalary) metadata.previousSalary = parseFloat(formData.previousSalary)
    if (formData.newSalary) metadata.newSalary = parseFloat(formData.newSalary)
    if (formData.incrementPercentage) metadata.incrementPercentage = parseFloat(formData.incrementPercentage)
    if (formData.effectiveDate) metadata.effectiveDate = formData.effectiveDate
    if (formData.joinDate) metadata.joinDate = formData.joinDate
    if (formData.lastWorkingDate) metadata.lastWorkingDate = formData.lastWorkingDate
    if (formData.resignationDate) metadata.resignationDate = formData.resignationDate
    if (formData.remarks) metadata.remarks = formData.remarks
    if (formData.department) metadata.department = formData.department
    if (formData.stipend) metadata.stipend = parseFloat(formData.stipend)
    if (formData.duration) metadata.duration = formData.duration
    if (formData.internshipType) metadata.internshipType = formData.internshipType
    if (formData.location) metadata.location = formData.location
    if (formData.startDate) metadata.startDate = formData.startDate
    if (formData.endDate) metadata.endDate = formData.endDate
    onSubmit({
      employeeId: formData.employeeId,
      documentType: formData.documentType,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    })
  }

  // ── Step 1: Pick doc type + employee/applicant ──
  if (step === 1) {
    return (
      <div className="space-y-4">
        <div>
          <Label>Document Type</Label>
          <Select
            value={formData.documentType}
            onValueChange={(value) => setFormData({ ...formData, documentType: value, employeeId: '', applicantName: '', applicantEmail: '' })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DOCUMENT_TYPES)
                .filter(([k]) => k !== 'CUSTOM')
                .map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {formData.documentType ? (
          <div>
            <Label>Employee</Label>
            <Select
              value={formData.employeeId}
              onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.user?.name ?? emp.employeeCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            disabled={!canProceed}
            onClick={() => setStep(2)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  // ── Step 2: Document details ──
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium">{summaryLabel}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{DOCUMENT_TYPES[formData.documentType]}</span>
        <button
          type="button"
          onClick={() => setStep(1)}
          className="ml-auto text-xs text-primary hover:underline"
        >
          Change
        </button>
      </div>

      {/* Document-specific fields */}
      {formData.documentType === 'OFFER_LETTER' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Designation</Label>
              <Input
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="e.g., BD Executive"
              />
            </div>
            <div>
              <Label>Annual CTC</Label>
              <Input
                type="number"
                value={formData.ctc}
                onChange={(e) => setFormData({ ...formData, ctc: e.target.value })}
                placeholder="e.g., 300000"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label>Relation</Label>
              <Select
                value={formData.guardianRelation}
                onValueChange={(value) => setFormData({ ...formData, guardianRelation: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="S/O">S/O</SelectItem>
                  <SelectItem value="D/O">D/O</SelectItem>
                  <SelectItem value="W/O">W/O</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Guardian Name</Label>
              <Input
                value={formData.guardianName}
                onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                placeholder="Father&apos;s / Mother&apos;s name"
              />
            </div>
          </div>
          <div>
            <Label>Address</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Full residential address"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isSales"
              checked={formData.isSales}
              onCheckedChange={(checked) => setFormData({ ...formData, isSales: !!checked })}
            />
            <Label htmlFor="isSales" className="cursor-pointer font-normal">Sales position (include targets)</Label>
          </div>
          {formData.isSales && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sales Target</Label>
                <Input
                  value={formData.salesTarget}
                  onChange={(e) => setFormData({ ...formData, salesTarget: e.target.value })}
                  placeholder="e.g., 10 Surgeries"
                />
              </div>
              <div>
                <Label>Monthly Target</Label>
                <Input
                  value={formData.monthlyTarget}
                  onChange={(e) => setFormData({ ...formData, monthlyTarget: e.target.value })}
                  placeholder="e.g., 5/month"
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Joining Date</Label>
              <Input
                type="date"
                value={formData.joiningDate}
                onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Acceptance Deadline</Label>
              <Input
                type="date"
                value={formData.acceptanceDeadline}
                onChange={(e) => setFormData({ ...formData, acceptanceDeadline: e.target.value })}
              />
            </div>
          </div>
        </>
      )}

      {formData.documentType === 'INCREMENT_LETTER' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Designation</Label>
              <Input
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="e.g., BD Manager"
              />
            </div>
            <div>
              <Label>Join Date</Label>
              <Input
                type="date"
                value={formData.joinDate}
                onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Previous Annual CTC</Label>
              <Input
                type="number"
                value={formData.previousSalary}
                onChange={(e) => setFormData({ ...formData, previousSalary: e.target.value })}
                placeholder="Previous CTC"
              />
            </div>
            <div>
              <Label>Increment %</Label>
              <Input
                type="number"
                value={formData.incrementPercentage}
                onChange={(e) => setFormData({ ...formData, incrementPercentage: e.target.value })}
                placeholder="e.g., 12.5"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>New Annual CTC (auto if empty)</Label>
              <Input
                type="number"
                value={formData.newSalary}
                onChange={(e) => setFormData({ ...formData, newSalary: e.target.value })}
                placeholder="New CTC"
              />
            </div>
            <div>
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Remarks (optional)</Label>
            <Input
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Any additional remarks"
            />
          </div>
        </>
      )}

      {formData.documentType === 'EXPERIENCE_LETTER' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Designation</Label>
            <Input
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              placeholder="Employee designation"
            />
          </div>
          <div>
            <Label>Last Working Date</Label>
            <Input
              type="date"
              value={formData.lastWorkingDate}
              onChange={(e) => setFormData({ ...formData, lastWorkingDate: e.target.value })}
            />
          </div>
        </div>
      )}

      {formData.documentType === 'RELIEVING_LETTER' && (
        <>
          <div>
            <Label>Designation</Label>
            <Input
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              placeholder="Employee designation"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Resignation Date</Label>
              <Input
                type="date"
                value={formData.resignationDate}
                onChange={(e) => setFormData({ ...formData, resignationDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Last Working Date</Label>
              <Input
                type="date"
                value={formData.lastWorkingDate}
                onChange={(e) => setFormData({ ...formData, lastWorkingDate: e.target.value })}
              />
            </div>
          </div>
        </>
      )}

      {formData.documentType === 'INTERNSHIP_OFFER_LETTER' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Internship Title</Label>
              <Input
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="e.g., Marketing Intern"
              />
            </div>
            <div>
              <Label>Monthly Stipend</Label>
              <Input
                type="number"
                value={formData.stipend}
                onChange={(e) => setFormData({ ...formData, stipend: e.target.value })}
                placeholder="e.g., 10000 (0 for unpaid)"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Duration</Label>
              <Input
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g., 3 Months"
              />
            </div>
            <div>
              <Label>Internship Type</Label>
              <Select
                value={formData.internshipType}
                onValueChange={(value) => setFormData({ ...formData, internshipType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full-time">Full-time</SelectItem>
                  <SelectItem value="Part-time">Part-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Location</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Noida Office"
              />
            </div>
            <div>
              <Label>Department</Label>
              <Input
                value={formData.department || ''}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g., Marketing"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label>Relation</Label>
              <Select
                value={formData.guardianRelation}
                onValueChange={(value) => setFormData({ ...formData, guardianRelation: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="S/O">S/O</SelectItem>
                  <SelectItem value="D/O">D/O</SelectItem>
                  <SelectItem value="W/O">W/O</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Guardian Name</Label>
              <Input
                value={formData.guardianName}
                onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                placeholder="Father's / Mother's name"
              />
            </div>
          </div>
          <div>
            <Label>Address</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Full residential address"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Acceptance Deadline</Label>
              <Input
                type="date"
                value={formData.acceptanceDeadline}
                onChange={(e) => setFormData({ ...formData, acceptanceDeadline: e.target.value })}
              />
            </div>
          </div>
        </>
      )}

      {formData.documentType === 'INTERNSHIP_COMPLETION_LETTER' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Internship Title</Label>
              <Input
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="e.g., Marketing Intern"
              />
            </div>
            <div>
              <Label>Department</Label>
              <Input
                value={formData.department || ''}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g., Marketing"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>
        </>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={() => setStep(1)}>
          Back
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate Document'}
        </Button>
      </div>
    </form>
  )
}
