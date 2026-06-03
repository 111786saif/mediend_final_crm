'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { FileText, ExternalLink, Check, Clock, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface EmployeeDocument {
  id: string
  documentType: 'OFFER_LETTER' | 'INCREMENT_LETTER' | 'EXPERIENCE_LETTER' | 'RELIEVING_LETTER' | 'INTERNSHIP_OFFER_LETTER' | 'INTERNSHIP_COMPLETION_LETTER' | 'EXIT_INTERVIEW_FORM' | 'CUSTOM'
  documentUrl?: string | null
  title?: string | null
  generatedAt: string
  ackToken?: string | null
  acknowledgedAt?: string | null
}

const DOCUMENT_TYPES: Record<string, string> = {
  OFFER_LETTER: 'Offer Letter',
  INCREMENT_LETTER: 'Increment Letter',
  EXPERIENCE_LETTER: 'Experience Letter',
  RELIEVING_LETTER: 'Relieving Letter',
  INTERNSHIP_OFFER_LETTER: 'Internship Offer Letter',
  INTERNSHIP_COMPLETION_LETTER: 'Internship Completion Certificate',
  EXIT_INTERVIEW_FORM: 'Exit Interview Form',
  CUSTOM: 'Custom',
}

function getDocumentLabel(doc: EmployeeDocument): string {
  if (doc.documentType === 'CUSTOM' && doc.title) return doc.title
  return DOCUMENT_TYPES[doc.documentType] ?? doc.documentType
}

export default function EmployeeDocumentsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: documents = [], isLoading } = useQuery<EmployeeDocument[]>({
    queryKey: ['my-documents'],
    queryFn: () => apiGet<EmployeeDocument[]>('/api/employee/documents'),
  })

  const acknowledgeMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/employee/documents/${docId}`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to acknowledge')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-documents'] })
      toast.success('Document acknowledged successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to acknowledge')
    },
  })

  const handleViewDocument = (doc: EmployeeDocument) => {
    if (doc.documentType === 'CUSTOM' && doc.documentUrl) {
      window.open(doc.documentUrl, '_blank')
    } else {
      router.push(`/employee/documents/${doc.id}/view`)
    }
  }

  const handleAcknowledge = async (docId: string) => {
    acknowledgeMutation.mutate(docId)
  }

  const pendingDocs = documents.filter((d) => !d.acknowledgedAt)
  const acknowledgedDocs = documents.filter((d) => d.acknowledgedAt)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Documents</h1>
        <p className="text-muted-foreground mt-1">View, download, and acknowledge your employment documents</p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents available yet</p>
              <p className="text-sm mt-1">Documents will appear here once HR generates them for you</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {pendingDocs.length > 0 && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                  Pending Acknowledgment
                </CardTitle>
                <CardDescription className="text-amber-700 dark:text-amber-500">
                  Please review and acknowledge the following documents. Click &quot;View &amp; Acknowledge&quot; to open and confirm receipt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Type</TableHead>
                      <TableHead>Generated On</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDocs.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <Badge variant="secondary">{getDocumentLabel(doc)}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(doc.generatedAt), 'PPP')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDocument(doc)}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleAcknowledge(doc.id)}
                              disabled={acknowledgeMutation.isPending}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              {acknowledgeMutation.isPending ? 'Acknowledging...' : 'Acknowledge'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {acknowledgedDocs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-600" />
                  Acknowledged Documents
                </CardTitle>
                <CardDescription>
                  Documents you have reviewed and acknowledged
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Type</TableHead>
                      <TableHead>Generated On</TableHead>
                      <TableHead>Acknowledged</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {acknowledgedDocs.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <Badge variant="secondary">{getDocumentLabel(doc)}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(doc.generatedAt), 'PPP')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
                            <Check className="h-3 w-3 mr-1" />
                            {format(new Date(doc.acknowledgedAt!), 'PPp')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDocument(doc)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            {doc.documentType === 'CUSTOM' ? 'Open' : 'View'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
