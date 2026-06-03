'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Printer, ArrowLeft, Download, Mail, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface DocumentData {
  document: {
    id: string
    employeeId: string
    documentType: 'OFFER_LETTER' | 'INCREMENT_LETTER' | 'EXPERIENCE_LETTER' | 'RELIEVING_LETTER' | 'INTERNSHIP_OFFER_LETTER' | 'INTERNSHIP_COMPLETION_LETTER' | 'EXIT_INTERVIEW_FORM' | 'CUSTOM'
    documentUrl?: string | null
    title?: string | null
    generatedAt: string
    acknowledgedAt?: string | null
    metadata: Record<string, unknown>
    employee: {
      employeeCode: string
      user: {
        name: string
        email: string
      }
    }
  }
  htmlContent: string
}

const DOCUMENT_TITLES: Record<string, string> = {
  OFFER_LETTER: 'Offer Letter',
  INCREMENT_LETTER: 'Increment Letter',
  EXPERIENCE_LETTER: 'Experience Letter',
  RELIEVING_LETTER: 'Relieving Letter',
  INTERNSHIP_OFFER_LETTER: 'Internship Offer Letter',
  INTERNSHIP_COMPLETION_LETTER: 'Internship Completion Certificate',
  EXIT_INTERVIEW_FORM: 'Exit Interview Form',
  CUSTOM: 'Document',
}

export default function DocumentViewPage() {
  const params = useParams()
  const router = useRouter()
  const documentId = params.id as string

  const { data, isLoading, error } = useQuery<DocumentData>({
    queryKey: ['document', documentId],
    queryFn: () => apiGet<DocumentData>(`/api/hr/documents/${documentId}`),
    enabled: !!documentId,
  })

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    // Trigger print dialog which can be used to save as PDF
    window.print()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Document not found</p>
          <Button onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const documentTitle = data.document.title || DOCUMENT_TITLES[data.document.documentType]
  const isCustom = data.document.documentType === 'CUSTOM'
  const documentUrl = data.document.documentUrl

  if (isCustom && documentUrl) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="no-print p-4 bg-background border-b">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{documentTitle}</h1>
              <p className="text-sm text-muted-foreground">
                {data.document.employee.user.name} ({data.document.employee.employeeCode})
              </p>
            </div>
            <Button asChild>
              <a href={documentUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Document
              </a>
            </Button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">This is an uploaded document. Click below to open it.</p>
            <Button asChild size="lg">
              <a href={documentUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </a>
            </Button>
          </div>
        </div>
        {data.document.acknowledgedAt && (
          <div className="no-print p-4 border-t bg-muted/50 text-center text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            Acknowledged on {format(new Date(data.document.acknowledgedAt), 'PPP')} at {format(new Date(data.document.acknowledgedAt), 'p')}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Print controls - hidden when printing */}
      <div className="no-print p-4 bg-background border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{documentTitle}</h1>
              <p className="text-sm text-muted-foreground">
                {data.document.employee.user.name} ({data.document.employee.employeeCode})
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <EmailDocumentButton
              documentId={documentId}
              defaultEmail={data.document.employee.user.email}
              documentType={data.document.documentType}
            />
            <Button onClick={handleDownload} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="min-h-screen bg-gray-50 p-8 print:p-0 print:bg-white">
        <div className="max-w-4xl mx-auto">
          {/* Document Container */}
          <div className="bg-white shadow-lg rounded-lg overflow-hidden print:shadow-none print:rounded-none">
            <div 
              className="p-8 print:p-0"
              dangerouslySetInnerHTML={{ __html: data.htmlContent }} 
            />
          </div>
        </div>
      </div>

      {/* Footer - hidden when printing */}
      <div className="no-print p-4 border-t bg-muted/50">
        <div className="max-w-4xl mx-auto text-center text-sm text-muted-foreground space-y-1">
          <p>Generated on {format(new Date(data.document.generatedAt), 'PPP')} at {format(new Date(data.document.generatedAt), 'p')}</p>
          {data.document.acknowledgedAt && (
            <p className="text-emerald-600 dark:text-emerald-400 font-medium">
              Acknowledged on {format(new Date(data.document.acknowledgedAt), 'PPP')} at {format(new Date(data.document.acknowledgedAt), 'p')}
            </p>
          )}
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0.5cm;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          body {
            background: white !important;
            margin: 0;
            padding: 0;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          
          .print\\:rounded-none {
            border-radius: 0 !important;
          }
          
          .print\\:p-0 {
            padding: 0 !important;
          }
          
          .print\\:bg-white {
            background: white !important;
          }
        }
      `}</style>
    </>
  )
}

function EmailDocumentButton({
  documentId,
  defaultEmail,
  documentType,
}: {
  documentId: string
  defaultEmail: string
  documentType: string
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(defaultEmail)
  const [sending, setSending] = useState(false)

  const DOCUMENT_TITLES: Record<string, string> = {
    OFFER_LETTER: 'Offer Letter',
    INCREMENT_LETTER: 'Increment Letter',
    EXPERIENCE_LETTER: 'Experience Letter',
    RELIEVING_LETTER: 'Relieving Letter',
    INTERNSHIP_OFFER_LETTER: 'Internship Offer Letter',
    INTERNSHIP_COMPLETION_LETTER: 'Internship Completion Certificate',
  }
  const subjectLabel = DOCUMENT_TITLES[documentType] ?? documentType

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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), o && setEmail(defaultEmail))}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Mail className="h-4 w-4 mr-2" />
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

