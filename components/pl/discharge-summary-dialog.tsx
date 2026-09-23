'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PatientDischargeInfo } from '@/components/discharge/patient-discharge-info'

interface Props {
  leadId: number
  /** Pre-loaded discharge sheet from a parent query, to skip the panel's own fetch when present. */
  preloaded?: any | null
  /** Pass a custom trigger; defaults to a small outline button. */
  trigger?: React.ReactNode
}

export function DischargeSummaryDialog({ leadId, preloaded, trigger }: Props) {
  const [open, setOpen] = useState(false)

  const defaultTrigger = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={(e) => e.stopPropagation()}
      className="h-7 px-2 text-xs"
    >
      <FileText className="h-3.5 w-3.5 mr-1" />
      Discharge Summary
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Discharge Summary</DialogTitle>
          <DialogDescription>
            Read-only snapshot of the discharge sheet. To edit, open the discharge form.
          </DialogDescription>
        </DialogHeader>

        {/* When a discharge sheet is preloaded, render discharge-only (no extra fetch). Otherwise
            the panel lazy-fetches the full lead and shows patient + discharge details. */}
        <PatientDischargeInfo
          leadId={leadId}
          lead={preloaded ? { id: leadId, dischargeSheet: preloaded } : undefined}
          showPatient={!preloaded}
        />
      </DialogContent>
    </Dialog>
  )
}
