import { NotificationType } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { isUserInMDManagedCohort } from '@/lib/hierarchy'

const MD_LINK = '/md/attendance'
const HR_LINK = '/hr/attendance-leaves?tab=normalizations'

export async function notifyNormalizationPendingReview(params: {
  subjectUserId: string
  message: string
  relatedEmployeeId: string
}) {
  const routeToMd = await isUserInMDManagedCohort(params.subjectUserId)
  if (routeToMd) {
    const recipients = await prisma.user.findMany({
      where: { role: 'MD' },
      select: { id: true },
    })
    if (recipients.length === 0) return
    await prisma.notification.createMany({
      data: recipients.map((u) => ({
        userId: u.id,
        type: NotificationType.NORMALIZATION_REQUESTED,
        title: 'Normalization Request',
        message: params.message,
        link: MD_LINK,
        relatedId: params.relatedEmployeeId,
      })),
    })
    return
  }

  const hrHeads = await prisma.user.findMany({
    where: { role: 'HR_HEAD' },
    select: { id: true },
  })
  if (hrHeads.length === 0) return
  await prisma.notification.createMany({
    data: hrHeads.map((h) => ({
      userId: h.id,
      type: NotificationType.NORMALIZATION_REQUESTED,
      title: 'Normalization Request',
      message: params.message,
      link: HR_LINK,
      relatedId: params.relatedEmployeeId,
    })),
  })
}
