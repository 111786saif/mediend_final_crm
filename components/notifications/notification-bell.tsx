'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNotifications, useUnreadCount, useMarkNotificationRead } from '@/hooks/use-notifications'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X } from 'lucide-react'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { data: notifications } = useNotifications(true) // Only fetch unread notifications
  const { data: unreadCount } = useUnreadCount()
  const markAsRead = useMarkNotificationRead()
  const queryClient = useQueryClient()

  const handleNotificationClick = async (notification: { id: string; link: string | null; isRead: boolean }) => {
    if (notification.link) {
      if (!notification.isRead) {
        try {
          await markAsRead.mutateAsync(notification.id)
        } catch {
          /* still navigate */
        }
      }
      router.push(notification.link)
    }
    setOpen(false)
  }

  const handleMarkAsRead = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    await markAsRead.mutateAsync(notificationId)
    // Invalidate both notifications and unread count
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
  }

  const count = unreadCount?.count || 0

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {count > 9 ? '9+' : count}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>
          Notifications
          {count > 0 && (
            <Badge variant="secondary" className="ml-2">
              {count} unread
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {notifications && notifications.length > 0 ? (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="cursor-pointer bg-muted"
                onClick={() => handleNotificationClick(notification)}
                onSelect={(e) => e.preventDefault()}
              >
                <div className="flex flex-col gap-1 w-full pr-6">
                  <div className="flex items-start justify-between">
                    <span className="font-medium text-sm">{notification.title}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 -mr-2 -mt-1"
                      onClick={(e) => handleMarkAsRead(e, notification.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <span className="text-xs text-muted-foreground">{notification.message}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                  </span>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No unread notifications
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
