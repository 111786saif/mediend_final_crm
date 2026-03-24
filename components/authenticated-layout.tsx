'use client'

/**
 * AuthenticatedLayout is now a simple wrapper component.
 * The sidebar and mobile bottom navigation (including tab badges) are handled at the
 * root layout level via AuthenticatedWrapper (`components/authenticated-wrapper.tsx`).
 * This component is kept for backward compatibility but no longer adds the sidebar.
 */
export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

