import { prisma } from '@/lib/prisma'
import { NotificationType } from '@/generated/prisma/client'

export interface LeadAssignedNotificationParams {
  userId: string
  patientName: string
  leadRef: string
  leadId: number
  actorUserId?: string
}

/**
 * Creates a notification when a new lead is assigned to a BD / user.
 */
export async function createLeadAssignedNotification(params: LeadAssignedNotificationParams) {
  if (!params.userId || params.userId === params.actorUserId) return
  try {
    return await prisma.notification.create({
      data: {
        userId: params.userId,
        type: NotificationType.TASK_ASSIGNED,
        title: 'New Lead Assigned',
        message: `You have been assigned a new lead: ${params.patientName?.trim() || 'Patient'} (${params.leadRef})`,
        link: `/patient/${params.leadId}`,
        relatedId: String(params.leadId),
      },
    })
  } catch (err) {
    console.error('Failed to create lead assigned notification:', err)
  }
}
