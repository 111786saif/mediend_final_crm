import { cookies } from 'next/headers'
import { SessionUser } from './auth'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const SESSION_COOKIE_NAME = 'mediend_session'

export interface SessionToken {
  userId: string
  email: string
  role: string
  teamId?: string | null
}

export async function createSession(user: SessionUser): Promise<string> {
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      teamId: user.teamId,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  return token
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionToken
    return {
      id: decoded.userId,
      email: decoded.email,
      name: '', // Will be fetched from DB if needed
      role: decoded.role as SessionUser['role'],
      teamId: decoded.teamId || null,
    }
  } catch {
    return null
  }
}

/** Session with current role/teamId from DB (JWT can be stale after admin assigns team or role). */
export async function getSessionWithFreshUser(): Promise<SessionUser | null> {
  const session = await getSession()
  if (!session) return null
  const row = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true, role: true, teamId: true },
  })
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    teamId: row.teamId,
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export function getSessionFromRequest(request: Request): SessionUser | null {
  // For API routes, extract from Authorization header or cookie
  const authHeader = request.headers.get('authorization')
  const cookieHeader = request.headers.get('cookie')
  
  let token: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  } else if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const eqIdx = cookie.indexOf('=')
      if (eqIdx === -1) return acc
      const key = cookie.slice(0, eqIdx).trim()
      const value = cookie.slice(eqIdx + 1)
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
    token = cookies[SESSION_COOKIE_NAME] || null
  }

  if (!token) {
    return null
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionToken
    return {
      id: decoded.userId,
      email: decoded.email,
      name: '',
      role: decoded.role as SessionUser['role'],
      teamId: decoded.teamId || null,
    }
  } catch {
    return null
  }
}

