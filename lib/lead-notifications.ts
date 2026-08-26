import { prisma } from '@/lib/prisma'
import { NotificationType } from '@/generated/prisma/client'

export interface LeadAssignedNotificationParams {
  userId: string
  patientName: string
  leadRef: string
  leadId: string
  actorUserId?: string
}

/**
 * Creates a notification when a new lead is assigned to a BD / user.
 */
export async function createLeadAssignedNotification(params: LeadAssignedNotificationParams) {
  if (!params.userId) return
  try {
    return await prisma.notification.create({
      data: {
        userId: params.userId,
        type: NotificationType.TASK_ASSIGNED,
        title: 'New Lead Assigned',
        message: `You have been assigned a new lead: ${params.patientName?.trim() || 'Patient'} (${params.leadRef})`,
        link: `/patient/${params.leadId}`,
        relatedId: params.leadId,
      },
    })
  } catch (err) {
    console.error('Failed to create lead assigned notification:', err)
  }
}

/**
 * Creates bulk notifications when multiple leads are assigned or reassigned.
 */
export async function createBulkLeadAssignedNotifications(
  items: Array<{
    userId: string
    patientName: string
    leadRef: string
    leadId: string
  }>
) {
  if (!items || items.length === 0) return
  try {
    return await prisma.notification.createMany({
      data: items
        .filter((item) => Boolean(item.userId))
        .map((item) => ({
          userId: item.userId,
          type: NotificationType.TASK_ASSIGNED,
          title: 'New Lead Assigned',
          message: `You have been assigned a new lead: ${item.patientName?.trim() || 'Patient'} (${item.leadRef})`,
          link: `/patient/${item.leadId}`,
          relatedId: item.leadId,
        })),
    })
  } catch (err) {
    console.error('Failed to create bulk lead assigned notifications:', err)
  }
}
