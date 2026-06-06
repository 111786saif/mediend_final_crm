"use client"

import { useEffect, useState } from "react"
import { ListFilter } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

export interface FilterDrawerValues {
  hospitalName: string | null
  surgeonName: string | null
  circle: string | null
  bdId: string | null
  treatment: string | null
}

const EMPTY_VALUES: FilterDrawerValues = {
  hospitalName: null,
  surgeonName: null,
  circle: null,
  bdId: null,
  treatment: null,
}

interface FilterOptions {
  hospitals: string[]
  doctors: string[]
  circles: string[]
  treatments: string[]
  bds: { id: string; name: string }[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: FilterDrawerValues
  onChange: (v: FilterDrawerValues) => void
  options: FilterOptions | undefined
}

function FilterSection({
  label,
  value,
  onValueChange,
  options,
  placeholder,
}: {
  label: string
  value: string | null
  onValueChange: (v: string | null) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  const selectedValue = value ?? "all"

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Select
        value={selectedValue}
        onValueChange={(v) => onValueChange(v === "all" ? null : v)}
      >
        <SelectTrigger className="h-10 w-full rounded-lg">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-[240px] overflow-y-auto">
          <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function countActiveFilters(v: FilterDrawerValues): number {
  return [v.hospitalName, v.surgeonName, v.circle, v.bdId, v.treatment].filter(
    Boolean,
  ).length
}

export function FilterDrawer({
  open,
  onOpenChange,
  value,
  onChange,
  options,
}: Props) {
  const [draft, setDraft] = useState<FilterDrawerValues>(value)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const apply = () => {
    onChange(draft)
    onOpenChange(false)
  }

  const clearAll = () => {
    setDraft({ ...EMPTY_VALUES })
  }

  const activeCount = countActiveFilters(draft)

  const set = (key: keyof FilterDrawerValues, val: string | null) => {
    setDraft((prev) => ({ ...prev, [key]: val }))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl sm:max-w-md sm:mx-auto max-h-[92vh] overflow-hidden flex flex-col"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ListFilter className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {activeCount}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 pb-4">
          <div className="space-y-5">
            {!options ? (
              <p className="text-sm text-muted-foreground py-4">
                Loading filter options...
              </p>
            ) : (
              <>
                <FilterSection
                  label="Hospital"
                  value={draft.hospitalName}
                  onValueChange={(v) => set("hospitalName", v)}
                  options={
                    options.hospitals.map((h) => ({ value: h, label: h }))
                  }
                  placeholder="Select hospital"
                />
                <FilterSection
                  label="Doctor"
                  value={draft.surgeonName}
                  onValueChange={(v) => set("surgeonName", v)}
                  options={
                    options.doctors.map((d) => ({ value: d, label: d }))
                  }
                  placeholder="Select doctor"
                />
                <FilterSection
                  label="Circle"
                  value={draft.circle}
                  onValueChange={(v) => set("circle", v)}
                  options={
                    options.circles.map((c) => ({ value: c, label: c }))
                  }
                  placeholder="Select circle"
                />
                <FilterSection
                  label="BD"
                  value={draft.bdId}
                  onValueChange={(v) => set("bdId", v)}
                  options={
                    options.bds.map((b) => ({
                      value: b.id,
                      label: b.name,
                    }))
                  }
                  placeholder="Select BD"
                />
                <FilterSection
                  label="Treatment / Disease"
                  value={draft.treatment}
                  onValueChange={(v) => set("treatment", v)}
                  options={
                    options.treatments.map((t) => ({
                      value: t,
                      label: t,
                    }))
                  }
                  placeholder="Select treatment"
                />
              </>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <div className="flex gap-2 px-4 py-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={clearAll}
            disabled={activeCount === 0}
          >
            Clear all
          </Button>
          <Button className="flex-1" onClick={apply}>
            Apply{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
