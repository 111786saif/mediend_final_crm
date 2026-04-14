"use client"

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { AlertTriangle } from "lucide-react"
import type { Warning } from "@/hooks/use-tasks"

export interface WarningsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberName: string
  warnings: Warning[]
}

export function WarningsDrawer({
  open,
  onOpenChange,
  memberName,
  warnings,
}: WarningsDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full max-h-dvh w-full max-w-md sm:max-w-lg ml-auto rounded-l-2xl rounded-r-none flex flex-col overflow-hidden">
        <DrawerHeader className="shrink-0 border-b">
          <DrawerTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Warnings — {memberName}
          </DrawerTitle>
        </DrawerHeader>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-3 pb-8">
            {warnings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8">No warnings</p>
            ) : (
              warnings.map((w) => (
                <div
                  key={w.id}
                  className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium capitalize text-amber-900 dark:text-amber-100">
                      {w.type.replace(/_/g, " ").toLowerCase()}
                    </span>
                    <span className="text-xs text-amber-600/80 dark:text-amber-400/80">
                      {format(new Date(w.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  {w.task ? (
                    <p className="text-xs font-medium text-amber-700/90 dark:text-amber-300/90 mb-1">
                      Task: {w.task.title}
                    </p>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 mb-1">
                      General
                    </span>
                  )}
                  {w.note && (
                    <p className="text-sm text-amber-800/90 dark:text-amber-200/90">
                      {w.note}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}
