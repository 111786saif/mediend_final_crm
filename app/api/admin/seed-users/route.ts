import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { UserRole } from '@/generated/prisma/client'

const VALID_ROLES = Object.values(UserRole)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

    if (body && body.email) {
      const { email, password, name, role } = body

      if (!email || !password || !name || !role) {
        return errorResponse('Missing required fields: email, password, name, role', 400)
      }

      if (!VALID_ROLES.includes(role)) {
        return errorResponse(`Invalid role. Valid roles: ${VALID_ROLES.join(', ')}`, 400)
      }

      const normalizedEmail = email.toLowerCase().trim()
      const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
      if (existingUser) return errorResponse('User with this email already exists', 400)

      const passwordHash = await hashPassword(password)
      const user = await prisma.user.create({
        data: { email: normalizedEmail, passwordHash, name, role },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      })

      return successResponse({ message: 'User created successfully', user })
    }

    // No body provided — seed default users
    const defaultEmails = [
      'admin@mediend.com', 'saleshead@mediend.com', 'bd@mediend.com',
      'insurance@mediend.com', 'pl@mediend.com', 'hr@mediend.com', 'finance@mediend.com',
    ]

    const existingDefaultUsers = await prisma.user.findMany({ where: { email: { in: defaultEmails } } })
    if (existingDefaultUsers.length === defaultEmails.length) {
      return errorResponse('Default users already exist.', 400)
    }

    const seededUsers = []

    if (!existingDefaultUsers.find((u) => u.email === 'admin@mediend.com')) {
      await prisma.user.create({ data: { email: 'admin@mediend.com', passwordHash: await hashPassword('Admin@123'), name: 'System Admin', role: 'ADMIN' } })
      seededUsers.push({ email: 'admin@mediend.com', password: 'Admin@123', role: 'ADMIN' })
    }

    if (!existingDefaultUsers.find((u) => u.email === 'saleshead@mediend.com')) {
      await prisma.user.create({ data: { email: 'saleshead@mediend.com', passwordHash: await hashPassword('SalesHead@123'), name: 'Sales Head', role: 'SALES_HEAD' } })
      seededUsers.push({ email: 'saleshead@mediend.com', password: 'SalesHead@123', role: 'SALES_HEAD' })
    }

    if (!existingDefaultUsers.find((u) => u.email === 'bd@mediend.com')) {
      await prisma.user.create({ data: { email: 'bd@mediend.com', passwordHash: await hashPassword('BD@123'), name: 'Sample BD', role: 'BD' } })
      seededUsers.push({ email: 'bd@mediend.com', password: 'BD@123', role: 'BD' })
    }

    if (!existingDefaultUsers.find((u) => u.email === 'insurance@mediend.com')) {
      await prisma.user.create({ data: { email: 'insurance@mediend.com', passwordHash: await hashPassword('Insurance@123'), name: 'Insurance Head', role: 'INSURANCE_HEAD' } })
      seededUsers.push({ email: 'insurance@mediend.com', password: 'Insurance@123', role: 'INSURANCE_HEAD' })
    }

    if (!existingDefaultUsers.find((u) => u.email === 'pl@mediend.com')) {
      await prisma.user.create({ data: { email: 'pl@mediend.com', passwordHash: await hashPassword('PL@123'), name: 'P/L Head', role: 'PL_HEAD' } })
      seededUsers.push({ email: 'pl@mediend.com', password: 'PL@123', role: 'PL_HEAD' })
    }

    if (!existingDefaultUsers.find((u) => u.email === 'hr@mediend.com')) {
      await prisma.user.create({ data: { email: 'hr@mediend.com', passwordHash: await hashPassword('HR@123'), name: 'HR Head', role: 'HR_HEAD' } })
      seededUsers.push({ email: 'hr@mediend.com', password: 'HR@123', role: 'HR_HEAD' })
    }

    if (!existingDefaultUsers.find((u) => u.email === 'finance@mediend.com')) {
      await prisma.user.create({ data: { email: 'finance@mediend.com', passwordHash: await hashPassword('Finance@123'), name: 'Finance Head', role: 'FINANCE_HEAD' } })
      seededUsers.push({ email: 'finance@mediend.com', password: 'Finance@123', role: 'FINANCE_HEAD' })
    }

    return successResponse({ message: 'Default users created successfully', users: seededUsers }, 'Users seeded successfully')
  } catch (error) {
    console.error('Error seeding users:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse(`Failed to seed users: ${message}`, 500)
  }
}
