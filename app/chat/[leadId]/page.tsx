'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { useAuth } from '@/hooks/use-auth'
import { useParams, useRouter } from 'next/navigation'
import { ChatList } from '@/components/chat/chat-list'
import { ChatInterface } from '@/components/chat/chat-interface'
import { PatientDetailsPanel } from '@/components/chat/patient-details-panel'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Loader2 } from 'lucide-react'
import { canAccessChat } from '@/lib/chat/access'

interface Lead {
  id: string
  leadRef: string
  patientName: string
  phoneNumber: string
  circle?: string | null
  hospitalName: string
  treatment: string | null
  category: string | null
  caseStage: string
  kypSubmission?: {
    id: string
    status: string
    location?: string | null
    area?: string | null
  } | null
}

export default function ChatPage() {
  const { user } = useAuth()
  const params = useParams()
  const router = useRouter()
  const leadId = params.leadId as string | undefined

  const { data: lead, isLoading } = useQuery<Lead>({
    queryKey: ['lead', leadId],
    queryFn: () => apiGet<Lead>(`/api/leads/${leadId}`),
    enabled: !!leadId,
  })

  if (!user) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Please log in to access chat</div>
        </div>
      </AuthenticatedLayout>
    )
  }

  if (!canAccessChat(user)) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">You don&apos;t have access to chat</div>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="h-[calc(100vh-4rem)] flex">
        {/* Left Sidebar - Chat List */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold">Chats</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ChatList selectedLeadId={leadId} />
          </div>
        </div>

        {/* Center - Chat Interface */}
        <div className="flex-1 flex flex-col">
          {leadId ? (
            isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : lead ? (
              <ChatInterface leadId={leadId} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">Lead not found</div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">Select a conversation to start chatting</p>
                <p className="text-sm text-muted-foreground">Choose a patient from the list on the left</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Patient Details */}
        {leadId && lead && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-800 overflow-y-auto">
            <PatientDetailsPanel lead={lead} />
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  )
}
