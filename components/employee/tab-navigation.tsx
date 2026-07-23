'use client'

import { cn } from '@/lib/utils'

export type TabVariant =
  | 'core-hr'
  | 'financial'
  | 'support'
  | 'mental-health'
  | 'tasks'
  | 'hr-core'
  | 'hr-people'
  | 'hr-compensation'
  | 'hr-engagement'
  | 'sales'
  | 'pnl'
  | 'digital-marketing'
  | 'md-hr'

const variantStyles: Record<
  TabVariant,
  { active: string; inactive: string; list: string }
> = {
  tasks: {
    active: 'bg-blue-600 text-white border-blue-600',
    inactive:
      'border-border bg-card text-muted-foreground hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200',
    list: 'border-b border-border gap-0 bg-card',
  },
  'core-hr': {
    active: 'bg-green-600 text-white border-green-600',
    inactive:
      'border-border bg-card text-muted-foreground hover:bg-green-50 hover:text-green-700 hover:border-green-200',
    list: 'border-b border-border gap-0 bg-card',
  },
  financial: {
    active: 'bg-teal-600 text-white border-teal-600',
    inactive:
      'border-border bg-card text-muted-foreground hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200',
    list: 'border-b border-border gap-0 bg-card',
  },
  support: {
    active: 'bg-emerald-700 text-white border-emerald-700',
    inactive:
      'border-border bg-card text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200',
    list: 'border-b border-border gap-0 bg-card',
  },
  'mental-health': {
    active: 'bg-rose-600 text-white border-rose-600',
    inactive:
      'border-border bg-card text-muted-foreground hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200',
    list: 'border-b border-border gap-0 bg-card',
  },
  'hr-core': {
    active: 'bg-green-600 text-white border-green-600',
    inactive:
      'border-border bg-card text-muted-foreground hover:bg-green-50 hover:text-green-700 hover:border-green-200',
    list: 'border-b border-border gap-0 bg-card',
  },
  'hr-people': {
    active: 'bg-blue-600 text-white border-blue-600',
    inactive:
      'border-border bg-card text-muted-foreground hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200',
    list: 'border-b border-border gap-0 bg-card',
  },
  'hr-compensation': {
    active: 'bg-amber-600 text-white border-amber-600',
    inactive:
      'border-border bg-card text-muted-foreground hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200',
    list: 'border-b border-border gap-0 bg-card',
  },
  'hr-engagement': {
    active: 'bg-violet-600 text-white border-violet-600',
    inactive:
      'border-border bg-card text-muted-foreground hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200',
    list: 'border-b border-border gap-0 bg-card',
  },
  sales: {
    active: 'bg-blue-600 text-white dark:bg-blue-600 dark:text-white rounded-lg font-semibold shadow-sm border-none',
    inactive:
      'border-none text-muted-foreground hover:text-foreground hover:bg-background/60 rounded-lg',
    list: 'border-none gap-1 bg-muted p-1 rounded-xl w-fit mb-4 border border-border shadow-inner',
  },
  pnl: {
    active: 'bg-violet-600 text-white border-violet-600',
    inactive:
      'border-border bg-card text-muted-foreground hover:bg-violet-50 hover:text-violet-800 hover:border-violet-200',
    list: 'border-b border-border gap-0 bg-card',
  },
  'digital-marketing': {
    active: 'bg-violet-600 text-white border-violet-600',
    inactive:
      'border-border bg-card text-muted-foreground hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200',
    list: 'border-b border-border gap-0 bg-card',
  },
  'md-hr': {
    active: 'bg-emerald-600 text-white border-emerald-600',
    inactive:
      'border-border bg-card text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200',
    list: 'border-b border-border gap-0 bg-card',
  },
}

export interface TabItem {
  value: string
  label: string
  badge?: number
}

interface TabNavigationProps {
  tabs: TabItem[]
  value: string
  onValueChange: (value: string) => void
  variant?: TabVariant
  className?: string
}

export function TabNavigation({
  tabs,
  value,
  onValueChange,
  variant = 'core-hr',
  className,
}: TabNavigationProps) {
  const styles = variantStyles[variant]

  return (
    <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div
        role="tablist"
        className={cn(
          'flex border-b border-border -mb-px whitespace-nowrap',
          styles.list,
          className
        )}
      >
        {tabs.map((tab) => {
          const isActive = value === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onValueChange(tab.value)}
              className={cn(
                'inline-flex items-center justify-center rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0',
                isActive ? styles.active : styles.inactive
              )}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="ml-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
