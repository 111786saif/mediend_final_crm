'use client'

import { useMemo, useState } from 'react'
import { PieChart as PieChartIcon } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts'
import {
  prepareDistribution,
  type DistributionInput,
  type DistributionRow,
} from '@/lib/dashboard/prepare-distribution'
import styles from './DiseaseDistribution.module.css'

export type { DistributionInput }
export { prepareDistribution } from '@/lib/dashboard/prepare-distribution'

export type DiseaseDistributionProps = {
  data: DistributionInput[]
  loading?: boolean
  onCategoryClick?: (category: string) => void
}

type ChartRow = DistributionRow & {
  shortLabel: string
  color: string
}

const SLICE_COLOR_VARS = [
  'var(--dd-slice-1)',
  'var(--dd-slice-2)',
  'var(--dd-slice-3)',
  'var(--dd-slice-4)',
  'var(--dd-slice-5)',
  'var(--dd-slice-6)',
  'var(--dd-slice-7)',
  'var(--dd-slice-8)',
] as const

function assignSliceColors(rows: DistributionRow[]): ChartRow[] {
  let colorIndex = 0
  return rows.map((row) => ({
    ...row,
    shortLabel: shortLabel(row.category),
    color: row.isNeutral
      ? 'var(--dd-bar-neutral)'
      : SLICE_COLOR_VARS[colorIndex++ % SLICE_COLOR_VARS.length],
  }))
}

type PieSectorProps = {
  cx?: number
  cy?: number
  innerRadius?: number
  outerRadius?: number
  startAngle?: number
  endAngle?: number
  fill?: string
  payload?: ChartRow
  onCategoryClick?: (category: string) => void
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function shortLabel(name: string): string {
  if (name.length <= 22) return name
  return `${name.slice(0, 21)}…`
}

function AccessibleSector({
  cx = 0,
  cy = 0,
  innerRadius = 0,
  outerRadius = 0,
  startAngle = 0,
  endAngle = 0,
  fill,
  payload,
  onCategoryClick,
}: PieSectorProps) {
  const [hovered, setHovered] = useState(false)
  const category = payload?.category ?? 'Category'
  const count = payload?.count ?? 0
  const percent = payload?.percent ?? 0
  const clickCategory = payload?.clickCategory ?? category
  const interactive = Boolean(onCategoryClick)

  const activate = () => {
    if (interactive) onCategoryClick?.(clickCategory)
  }

  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      fillOpacity={hovered ? 0.85 : 1}
      stroke="var(--dd-surface)"
      strokeWidth={2}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={activate}
      tabIndex={interactive ? 0 : -1}
      role={interactive ? 'button' : undefined}
      aria-label={`${category}, ${count.toLocaleString()} cases, ${percent.toFixed(1)} percent`}
      onKeyDown={(event) => {
        if (!interactive) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          activate()
        }
      }}
    />
  )
}

function DiseaseTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: ChartRow }>
}) {
  if (!active || !payload?.[0]?.payload) return null
  const row = payload[0].payload

  return (
    <div className={styles.tooltip}>
      <div>{`${row.category} — ${row.count.toLocaleString()} cases (${formatPercent(row.percent)})`}</div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className={styles.loading} aria-busy="true" aria-live="polite">
      <div style={{ width: '100%' }}>
        <div className={styles.donutLayout}>
          <div className={styles.skeletonDonut} />
          <div className={styles.legendList}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className={styles.skeletonLegendRow} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function DiseaseDistribution({ data, loading = false, onCategoryClick }: DiseaseDistributionProps) {
  const prepared = useMemo(() => prepareDistribution(data), [data])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const chartRows = useMemo<ChartRow[]>(
    () => assignSliceColors(prepared.rows),
    [prepared.rows],
  )

  return (
    <section className={styles.widget} aria-label="Disease distribution">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <PieChartIcon size={18} aria-hidden />
          <span>Disease distribution</span>
        </div>
        <p className={styles.subtitle}>By case count</p>
      </div>

      {loading ? (
        <LoadingState />
      ) : chartRows.length === 0 ? (
        <div className={styles.empty}>No disease distribution data for this range.</div>
      ) : (
        <div className={styles.donutLayout}>
              <div className={styles.donutChartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartRows}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius="58%"
                      outerRadius="88%"
                      paddingAngle={1.5}
                      isAnimationActive={false}
                      activeIndex={activeIndex ?? undefined}
                      activeShape={(props) => (
                        <AccessibleSector {...props} onCategoryClick={onCategoryClick} />
                      )}
                      inactiveShape={(props) => (
                        <AccessibleSector {...props} onCategoryClick={onCategoryClick} />
                      )}
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      {chartRows.map((row) => (
                        <Cell key={row.category} fill={row.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<DiseaseTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.donutCenter} aria-hidden>
                  <div className={styles.donutCenterValue}>
                    {prepared.metrics.totalCases.toLocaleString()}
                  </div>
                  <div className={styles.donutCenterLabel}>Total cases</div>
                </div>
              </div>

              <ul className={styles.legendList} aria-label="Disease categories">
                {chartRows.map((row, index) => (
                  <li key={row.category}>
                    <button
                      type="button"
                      className={styles.legendItem}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                      onFocus={() => setActiveIndex(index)}
                      onBlur={() => setActiveIndex(null)}
                      onClick={() => onCategoryClick?.(row.clickCategory)}
                      aria-label={`${row.category}, ${row.count.toLocaleString()} cases, ${formatPercent(row.percent)}`}
                    >
                      <span
                        className={styles.legendSwatch}
                        style={{ background: row.color }}
                        aria-hidden
                      />
                      <span className={styles.legendName}>{row.shortLabel}</span>
                      <span className={styles.legendValue}>
                        {row.count.toLocaleString()}
                        <span className={styles.legendPercent}>{formatPercent(row.percent)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
      )}
    </section>
  )
}
