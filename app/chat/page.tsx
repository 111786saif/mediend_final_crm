'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { ChatList } from '@/components/chat/chat-list'
import { useEffect } from 'react'
import { canAccessChat } from '@/lib/chat/access'

export default function ChatPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    if (!canAccessChat(user)) {
      router.push('/')
    }
  }, [user, router])

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
        <div className="w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold">Chats</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ChatList />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Select a conversation to start chatting</p>
            <p className="text-sm text-muted-foreground">Choose a patient from the list on the left</p>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
