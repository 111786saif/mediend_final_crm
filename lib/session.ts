import { cookies } from 'next/headers'
import { SessionUser } from './auth'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const SESSION_COOKIE_NAME = 'mediend_session'

/** Secure cookies require HTTPS. Override with COOKIE_SECURE=false for HTTP/IP testing. */
function sessionCookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === 'true') return true
  if (process.env.COOKIE_SECURE === 'false') return false
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  if (appUrl.startsWith('https://')) return true
  if (appUrl.startsWith('http://')) return false
  return process.env.NODE_ENV === 'production'
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: sessionCookieSecure(),
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  }
}

export interface SessionToken {
  userId: string
  email: string
  role: string
}

export async function createSession(user: SessionUser): Promise<string> {
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions())

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
    }
  } catch {
    return null
  }
}

/** Session with current role from DB (JWT can be stale after admin changes role). */
export async function getSessionWithFreshUser(): Promise<SessionUser | null> {
  const session = await getSession()
  if (!session) return null
  const row = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      employee: { select: { onboardingStatus: true, status: true } },
    },
  })
  if (!row) return null
  // Drop sessions for terminated/absconded employees (HR marked inactive)
  const empStatus = row.employee?.status
  if (empStatus === 'TERMINATED' || empStatus === 'ABSCONDED') {
    return null
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    onboardingStatus: row.employee?.onboardingStatus ?? null,
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, '', { ...sessionCookieOptions(), maxAge: 0 })
}

export function getSessionFromRequest(request: Request): SessionUser | null {
  // For API routes, extract from Authorization header or cookie
  const authHeader = request.headers.get('authorization')
  const cookieHeader = request.headers.get('cookie')
  
  let token: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  } else if (cookieHeader) {
    const cookieMap = cookieHeader.split(';').reduce((acc, cookie) => {
      const eqIdx = cookie.indexOf('=')
      if (eqIdx === -1) return acc
      const key = cookie.slice(0, eqIdx).trim()
      const value = decodeURIComponent(cookie.slice(eqIdx + 1).trim())
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
    token = cookieMap[SESSION_COOKIE_NAME] || null
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
    }
  } catch {
    return null
  }
}
