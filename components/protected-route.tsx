'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'

const PUBLIC_PATHS = ['/login', '/documents/acknowledge', '/savemyleads']

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isPublicPath = pathname && PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  useEffect(() => {
    if (!isPublicPath && !isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router, isPublicPath])

  if (isPublicPath) {
    return <>{children}</>
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
