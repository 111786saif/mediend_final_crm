import { NextRequest, NextResponse } from 'next/server'
import { SessionUser } from './auth'
import { Permission, hasPermission } from './rbac'
import { getSession } from './session'
import { loadScopedPermissionMap, levelSatisfies } from './rbac-new'
import { PermissionLevel } from '@/generated/prisma/client'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  field?: string
  message?: string
}

export function sanitizeColumns<T extends Record<string, any>>(
  tableName: string,
  records: T[],
  permissions: Record<string, PermissionLevel>
): Partial<T>[] {
  return records.map(record => {
    if (!record) return record
    const cleanRecord = { ...record } as Record<string, any>
    
    for (const key of Object.keys(record)) {
      // If a permission policy exists for this column key, verify read access
      if (key in permissions) {
        const userLevel = permissions[key]
        if (!levelSatisfies(userLevel, PermissionLevel.READ)) {
          cleanRecord[key] = null
        }
      }
    }
    return cleanRecord as Partial<T>
  })
}

export async function successResponse<T>(
  data: T,
  message?: string,
  entityName?: string
): Promise<NextResponse<ApiResponse<T>>> {
  let sanitizedData = data

  if (entityName && data) {
    const session = await getSession()
    if (session?.id) {
      try {
        const isArray = Array.isArray(data)
        const rawRecords = isArray ? data : [data]
        const permissions = await loadScopedPermissionMap(session.id, entityName)
        const sanitized = sanitizeColumns(entityName, rawRecords, permissions)
        sanitizedData = (isArray ? sanitized : sanitized[0]) as unknown as T
      } catch (error) {
        console.error(`Column sanitization failed for entity ${entityName}:`, error)
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: sanitizedData,
    message,
  })
}

export function errorResponse(error: string, status: number = 400): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  )
}

export function fieldErrorResponse(
  error: string,
  field: string | undefined,
  status: number = 400
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(field ? { field } : {}),
    },
    { status }
  )
}

export function zodErrorResponse(err: import('zod').ZodError): NextResponse<ApiResponse> {
  const first = err.errors[0]
  return fieldErrorResponse(
    first?.message || 'Invalid input',
    first?.path?.[0] ? String(first.path[0]) : undefined,
    400
  )
}

export function unauthorizedResponse(message?: string): NextResponse<ApiResponse> {
  return errorResponse(message || 'Unauthorized', 401)
}

export function forbiddenResponse(): NextResponse<ApiResponse> {
  return errorResponse('Forbidden', 403)
}

// Simple session storage (in production, use proper session management)
// For now, we'll use a simple approach with cookies or headers
export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  // TODO: Implement proper session management
  // For now, this is a placeholder
  // In production, use JWT tokens, cookies, or session storage
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  // This should be replaced with actual session validation
  // For MVP, we'll implement a simple token-based approach
  return null
}

export async function requireAuth(request: NextRequest): Promise<SessionUser> {
  const user = await getSessionUser(request)
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requirePermission(
  request: NextRequest,
  permission: Permission
): Promise<SessionUser> {
  const user = await requireAuth(request)
  if (!hasPermission(user, permission)) {
    throw new Error('Forbidden')
  }
  return user
}

