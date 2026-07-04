import type { NextRequest } from 'next/server'

export function resolveCorsOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || 'https://workspace.mediend.com'
  const requestOrigin = request.headers.get('origin')
  if (!requestOrigin) return configured

  if (process.env.NODE_ENV === 'development') {
    try {
      const { hostname } = new URL(requestOrigin)
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return requestOrigin
      }
    } catch {
      // ignore invalid origin
    }
  }

  return requestOrigin === configured ? requestOrigin : configured
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}
