'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Scale } from 'lucide-react'
import { cn } from '@/lib/utils'

type Unit = 'metric' | 'mixed'

interface BMIResult {
  bmi: number
  category: string
  color: string
  bg: string
}

function classifyBMI(bmi: number): Omit<BMIResult, 'bmi'> {
  if (bmi < 18.5) return { category: 'Underweight', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/40' }
  if (bmi < 25) return { category: 'Normal Weight', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/40' }
  if (bmi < 30) return { category: 'Overweight', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/40' }
  if (bmi < 35) return { category: 'Obese (Class I)', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/40' }
  if (bmi < 40) return { category: 'Obese (Class II)', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/40' }
  return { category: 'Obese (Class III)', color: 'text-red-700', bg: 'bg-red-100 dark:bg-red-950/60' }
}

function BMIBar({ bmi }: { bmi: number }) {
  // Scale: 10 to 50, clamp for display
  const min = 10, max = 50
  const pct = Math.min(Math.max(((bmi - min) / (max - min)) * 100, 0), 100)
  return (
    <div className="relative h-3 w-full rounded-full overflow-hidden mt-1" style={{ background: 'linear-gradient(to right, #60a5fa, #4ade80, #facc15, #fb923c, #dc2626)' }}>
      <div
        className="absolute top-0 h-full w-0.5 bg-white shadow"
        style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
      />
    </div>
  )
}

export function BMICalculator() {
  const [open, setOpen] = useState(false)
  const [unit, setUnit] = useState<Unit>('mixed')
  const [weight, setWeight] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [heightFt, setHeightFt] = useState('')
  const [heightIn, setHeightIn] = useState('')
  const [result, setResult] = useState<BMIResult | null>(null)

  const reset = useCallback(() => {
    setWeight('')
    setHeightCm('')
    setHeightFt('')
    setHeightIn('')
    setResult(null)
  }, [])

  const calculate = useCallback(() => {
    const w = parseFloat(weight)
    if (!w || w <= 0) return

    let heightM = 0

    if (unit === 'metric') {
      const h = parseFloat(heightCm)
      if (!h || h <= 0) return
      heightM = h / 100
    } else {
      // mixed: kg + feet/inches
      const ft = parseFloat(heightFt) || 0
      const inches = parseFloat(heightIn) || 0
      const totalInches = ft * 12 + inches
      if (totalInches <= 0) return
      heightM = totalInches * 0.0254
    }

    if (heightM <= 0) return
    const bmi = w / (heightM * heightM)
    const { category, color, bg } = classifyBMI(bmi)
    setResult({ bmi, category, color, bg })
  }, [unit, weight, heightCm, heightFt, heightIn])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') calculate()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="BMI Calculator"
          aria-label="BMI Calculator"
        >
          <Scale className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-4"
        align="end"
        sideOffset={8}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">BMI Calculator</h3>
            <div className="flex rounded-md overflow-hidden border border-border text-xs">
              <button
                className={cn(
                  'px-2.5 py-1 transition-colors',
                  unit === 'mixed' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                )}
                onClick={() => { setUnit('mixed'); reset() }}
              >
                kg + in
              </button>
              <button
                className={cn(
                  'px-2.5 py-1 transition-colors',
                  unit === 'metric' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                )}
                onClick={() => { setUnit('metric'); reset() }}
              >
                kg + cm
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Weight (kg)</Label>
              <Input
                type="number"
                placeholder="e.g. 70"
                value={weight}
                onChange={(e) => { setWeight(e.target.value); setResult(null) }}
                onKeyDown={handleKeyDown}
                className="h-8 text-sm mt-0.5"
                min={1}
              />
            </div>

            {unit === 'mixed' ? (
              <div>
                <Label className="text-xs text-muted-foreground">Height</Label>
                <div className="flex gap-2 mt-0.5">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      placeholder="ft"
                      value={heightFt}
                      onChange={(e) => { setHeightFt(e.target.value); setResult(null) }}
                      onKeyDown={handleKeyDown}
                      className="h-8 text-sm pr-6"
                      min={0}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ft</span>
                  </div>
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      placeholder="in"
                      value={heightIn}
                      onChange={(e) => { setHeightIn(e.target.value); setResult(null) }}
                      onKeyDown={handleKeyDown}
                      className="h-8 text-sm pr-6"
                      min={0}
                      max={11}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">in</span>
                  </div>
                </div>
                {(heightFt || heightIn) && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    = {(((parseFloat(heightFt) || 0) * 12 + (parseFloat(heightIn) || 0)) * 2.54).toFixed(1)} cm
                    &nbsp;/&nbsp;{((parseFloat(heightFt) || 0) * 12 + (parseFloat(heightIn) || 0) * 0.0254).toFixed(3).replace(/^0/, '')} m
                  </p>
                )}
              </div>
            ) : (
              <div>
                <Label className="text-xs text-muted-foreground">Height (cm)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 170"
                  value={heightCm}
                  onChange={(e) => { setHeightCm(e.target.value); setResult(null) }}
                  onKeyDown={handleKeyDown}
                  className="h-8 text-sm mt-0.5"
                  min={1}
                />
                {heightCm && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    = {Math.floor(parseFloat(heightCm) / 30.48)}'{' '}
                    {Math.round((parseFloat(heightCm) / 2.54) % 12)}" &nbsp;/&nbsp; {(parseFloat(heightCm) / 100).toFixed(2)} m
                  </p>
                )}
              </div>
            )}
          </div>

          <Button size="sm" className="w-full h-8 text-xs" onClick={calculate}>
            Calculate BMI
          </Button>

          {result && (
            <div className={cn('rounded-lg p-3 space-y-1.5', result.bg)}>
              <div className="flex items-baseline justify-between">
                <span className={cn('text-2xl font-bold', result.color)}>
                  {result.bmi.toFixed(1)}
                </span>
                <span className={cn('text-xs font-medium', result.color)}>
                  {result.category}
                </span>
              </div>
              <BMIBar bmi={result.bmi} />
              <div className="flex justify-between text-[9px] text-muted-foreground pt-0.5">
                <span>Under</span>
                <span>Normal</span>
                <span>Over</span>
                <span>Obese</span>
              </div>
            </div>
          )}

          <div className="text-[9px] text-muted-foreground leading-relaxed border-t border-border pt-2">
            BMI is a screening tool only. It does not account for muscle mass, age, or body composition.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
