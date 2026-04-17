import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { UserRole } from '@/generated/prisma/enums'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: UserRole
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export class InactiveUserError extends Error {
  constructor(status: string) {
    const messages: Record<string, string> = {
      TERMINATED: 'Your account has been terminated. Please contact HR for assistance.',
      ABSCONDED: 'Your account has been deactivated. Please contact HR for assistance.',
      ON_NOTICE: 'Your account is on notice period and has been restricted. Please contact HR.',
    }
    super(messages[status] || 'Your account is inactive. Please contact HR for assistance.')
    this.name = 'InactiveUserError'
  }
}

export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  // Normalize email to lowercase
  const normalizedEmail = email.toLowerCase().trim()

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { employee: { select: { status: true } } },
  })

  if (!user) {
    return null
  }

  const isValid = await verifyPassword(password, user.passwordHash)
  if (!isValid) {
    return null
  }

  // Block login for terminated or absconded employees
  const empStatus = user.employee?.status
  if (empStatus === 'TERMINATED' || empStatus === 'ABSCONDED') {
    throw new InactiveUserError(empStatus)
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }
}

export async function getUserById(id: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  })

  return user
}

