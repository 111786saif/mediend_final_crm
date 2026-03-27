"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export type StatCardAccent =
  | "blue"
  | "green"
  | "amber"
  | "purple"
  | "red"
  | "orange"
  | "emerald"
  | "teal"
  | "neutral"

const accentStyles: Record<
  StatCardAccent,
  { border: string; value: string }
> = {
  blue: {
    border: "border-l-blue-500",
    value: "text-blue-600 dark:text-blue-400",
  },
  green: {
    border: "border-l-green-500",
    value: "text-green-600 dark:text-green-400",
  },
  amber: {
    border: "border-l-amber-500",
    value: "text-amber-600 dark:text-amber-400",
  },
  purple: {
    border: "border-l-purple-500",
    value: "text-purple-600 dark:text-purple-400",
  },
  red: {
    border: "border-l-red-500",
    value: "text-red-600 dark:text-red-400",
  },
  orange: {
    border: "border-l-orange-500",
    value: "text-orange-600 dark:text-orange-400",
  },
  emerald: {
    border: "border-l-emerald-500",
    value: "text-emerald-600 dark:text-emerald-400",
  },
  teal: {
    border: "border-l-teal-500",
    value: "text-teal-600 dark:text-teal-400",
  },
  neutral: {
    border: "border-l-border",
    value: "text-foreground",
  },
}

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Short label above the value (e.g. "Total", "Completed") */
  label: string
  /** Main value to display (number, string, or ReactNode) */
  value: React.ReactNode
  /** Smaller secondary line under the value (e.g. absolute count) */
  subValue?: React.ReactNode
  /** Accent color for the left border and optional value color */
  accent?: StatCardAccent
  /** If true, the value uses the accent color; if false, uses default foreground */
  valueAccent?: boolean
  /** When set, the card becomes a link to this URL */
  href?: string
}

function StatCard({
  label,
  value,
  subValue,
  accent = "neutral",
  valueAccent = false,
  href,
  className,
  ...props
}: StatCardProps) {
  const styles = accentStyles[accent]
  const baseClassName = cn(
    "rounded-lg border border-border border-l-4 bg-card px-3 py-3 shadow-sm block",
    styles.border,
    href && "cursor-pointer transition-colors hover:bg-muted/50 active:scale-[0.98]",
    className
  )
  const content = (
    <>
      <p className="text-sm md:text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-semibold leading-tight",
          valueAccent ? styles.value : "text-foreground"
        )}
      >
        {value}
      </p>
      {subValue != null && subValue !== "" && (
        <p className="text-xs text-muted-foreground mt-1 tabular-nums">{subValue}</p>
      )}
    </>
  )
  if (href) {
    return (
      <Link
        data-slot="stat-card"
        href={href}
        className={baseClassName}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </Link>
    )
  }
  return (
    <div data-slot="stat-card" className={baseClassName} {...props}>
      {content}
    </div>
  )
}

export { StatCard }
