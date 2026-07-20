import crypto from 'crypto'
import { Prisma } from '@/generated/prisma/client'
import { hashPassword } from '@/lib/auth'

type DoctorAppAccountTx = Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

function buildPlaceholderDoctorEmail(doctorId: string) {
  return `doctor-${doctorId}@doctor-app.local`
}

async function buildPlaceholderPasswordHash() {
  return hashPassword(crypto.randomBytes(24).toString('hex'))
}

export async function syncDoctorAppAccountFromMaster(
  tx: DoctorAppAccountTx,
  input: {
    doctorId: string
    phoneNumber: string | null | undefined
    isActive: boolean
  }
) {
  const { doctorId, phoneNumber, isActive } = input

  const existing = await tx.doctorAppAccount.findUnique({
    where: { doctorId },
    select: { id: true },
  })

  if (existing) {
    await tx.doctorAppAccount.update({
      where: { doctorId },
      data: {
        phoneNumber: phoneNumber ?? null,
        isActive,
      },
    })
    return
  }

  if (!phoneNumber) {
    return
  }

  await tx.doctorAppAccount.create({
    data: {
      doctorId,
      email: buildPlaceholderDoctorEmail(doctorId),
      phoneNumber,
      passwordHash: await buildPlaceholderPasswordHash(),
      isActive,
    },
  })
}
