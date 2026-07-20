import { prisma } from '@/lib/prisma'

export async function listDoctorAdminDoctors(search: string) {
  const query = search.trim()

  return prisma.doctorMaster.findMany({
    where: {
      isActive: true,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { category: { contains: query, mode: 'insensitive' } },
              { treatment: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      category: true,
      treatment: true,
      isActive: true,
    },
    orderBy: { name: 'asc' },
    take: 200,
  })
}
