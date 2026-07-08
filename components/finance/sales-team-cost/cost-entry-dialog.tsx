'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAddSalesTeamCostEntry } from '@/hooks/use-sales-team-cost'
import { toast } from 'sonner'

type CostEntryType = 'INCENTIVE' | 'SEATING' | 'MISC'

interface CostEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId: string
  employeeName: string
  entryType: CostEntryType
}

const ENTRY_META: Record<
  CostEntryType,
  { title: string; description: (name: string) => string; placeholder: string; success: string }
> = {
  INCENTIVE: {
    title: 'Add incentive',
    description: (name) =>
      `Record an incentive for ${name}. Only Sales Head can receive incentives.`,
    placeholder: 'Performance bonus, quarterly reward…',
    success: 'Incentive added',
  },
  SEATING: {
    title: 'Add seating cost',
    description: (name) => `Record a seating cost for ${name} (e.g. new desk, relocation).`,
    placeholder: 'New desk, relocation…',
    success: 'Seating cost added',
  },
  MISC: {
    title: 'Add misc cost',
    description: (name) => `Record a miscellaneous cost for ${name}.`,
    placeholder: 'Equipment, travel, other expense…',
    success: 'Misc cost added',
  },
}

export function CostEntryDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  entryType,
}: CostEntryDialogProps) {
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = useState('')
  const addEntry = useAddSalesTeamCostEntry()
  const meta = ENTRY_META[entryType]

  const reset = () => {
    setAmount('')
    setEntryDate(format(new Date(), 'yyyy-MM-dd'))
    setNote('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = Number(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (!entryDate) {
      toast.error('Select a date')
      return
    }

    try {
      await addEntry.mutateAsync({
        employeeId,
        entryType,
        amount: parsedAmount,
        entryDate,
        note: note.trim() || null,
      })
      toast.success(meta.success)
      reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save entry')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{meta.title}</DialogTitle>
            <DialogDescription>{meta.description(employeeName)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount (INR)</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="entryDate">Date</Label>
              <Input
                id="entryDate"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Reason</Label>
              <Textarea
                id="note"
                placeholder={meta.placeholder}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addEntry.isPending}>
              {addEntry.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
