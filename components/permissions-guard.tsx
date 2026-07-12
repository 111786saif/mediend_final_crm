'use client'

import * as React from 'react'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function PermissionsSpinner({ variant = 'card' }: { variant?: 'page' | 'card' }) {
  return (
    <div className={cn(
      'flex items-center justify-center text-center w-full',
      variant === 'page' ? 'flex-1 h-[60vh]' : 'h-[40vh]'
    )}>
      <div>
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="mt-4 text-sm text-muted-foreground">Checking permissions...</p>
      </div>
    </div>
  )
}

export function AccessDenied({
  resourceName,
  variant = 'card',
}: {
  resourceName?: string
  variant?: 'page' | 'card'
}) {
  if (variant === 'page') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] px-4 py-16 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4 animate-pulse" />
        <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Your account does not have permission to view {resourceName || 'this section'}. Please contact administration if you require access.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link href="/home">Return Home</Link>
        </Button>
      </div>
    )
  }

  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-3 animate-pulse" />
        <h3 className="text-lg font-bold text-foreground">Access Denied</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          Your account does not have permission to view {resourceName || 'this section'}. Please contact support if you require access.
        </p>
        <Button asChild className="mt-5" variant="outline" size="sm">
          <Link href="/home">Return Home</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

interface PermissionsGuardProps {
  isLoading: boolean
  hasAccess: boolean
  resourceName?: string
  variant?: 'page' | 'card'
  children: React.ReactNode
}

export function PermissionsGuard({
  isLoading,
  hasAccess,
  resourceName,
  variant = 'card',
  children,
}: PermissionsGuardProps) {
  if (isLoading) {
    return <PermissionsSpinner variant={variant} />
  }

  if (!hasAccess) {
    return <AccessDenied resourceName={resourceName} variant={variant} />
  }

  return <>{children}</>
}
