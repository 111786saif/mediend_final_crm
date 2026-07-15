'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { getFirstNavUrl } from '@/lib/sidebar-nav'

const PUBLIC_PATHS = ['/login', '/documents/acknowledge']

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isPublicPath = pathname && PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  const isOnboardingPath = pathname === '/onboarding' || pathname?.startsWith('/onboarding/')
  const needsOnboarding =
    !!user?.onboardingStatus && user.onboardingStatus !== 'APPROVED'

  useEffect(() => {
    if (!isPublicPath && !isLoading && !user) {
      router.push('/login')
      return
    }
    if (!isLoading && user && needsOnboarding && !isOnboardingPath && !isPublicPath) {
      router.push('/onboarding')
      return
    }
    if (!isLoading && user && !needsOnboarding && isOnboardingPath) {
      router.push(getFirstNavUrl(user))
    }
  }, [user, isLoading, router, isPublicPath, isOnboardingPath, needsOnboarding])

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

  if (needsOnboarding && !isOnboardingPath) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Redirecting to onboarding...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
