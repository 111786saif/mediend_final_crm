import { ApiResponse } from './api-utils'

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`
  
  // Don't set Content-Type for FormData - browser will set it with boundary
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    const err = new Error(error.error || `HTTP ${response.status}`) as Error & { field?: string }
    if (error.field) err.field = error.field
    throw err
  }

  return response.json()
}

export type FieldError = Error & { field?: string }

export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await apiRequest<T>(endpoint, { method: 'GET' })
  if (!response.success) {
    throw new Error(response.error || 'Request failed')
  }
  return response.data as T
}

export async function apiPost<T>(
  endpoint: string,
  data: unknown,
  options?: { headers?: Record<string, string> }
): Promise<T> {
  const isFormData = data instanceof FormData
  const headers: Record<string, string> = {
    ...options?.headers,
  }
  
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await apiRequest<T>(endpoint, {
    method: 'POST',
    body: isFormData ? data : JSON.stringify(data),
    headers,
  })
  if (!response.success) {
    throw new Error(response.error || 'Request failed')
  }
  return response.data as T
}

export async function apiPatch<T>(endpoint: string, data: unknown): Promise<T> {
  const response = await apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  if (!response.success) {
    throw new Error(response.error || 'Request failed')
  }
  return response.data as T
}

export async function apiDelete<T>(endpoint: string, data?: unknown): Promise<T> {
  const options: RequestInit = {
    method: 'DELETE',
  }
  if (data) {
    options.body = JSON.stringify(data)
  }
  const response = await apiRequest<T>(endpoint, options)
  if (!response.success) {
    throw new Error(response.error || 'Request failed')
  }
  return response.data as T
}

