// @ts-nocheck
'use client'

import { cn } from '@/lib/utils'

export function Section({ title, children, id }) {
  return (
    <section id={id} className="max-w-4xl mx-auto px-6 py-8 scroll-mt-20">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{title}</h2>
      {children}
    </section>
  )
}

export function SubSection({ title, children }) {
  return (
    <div className="mb-8">
      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

export function APITable({ routes }) {
  const methodColor = (m) => {
    if (m === 'POST') return 'bg-emerald-100 text-emerald-700'
    if (m === 'GET') return 'bg-blue-100 text-blue-700'
    if (m === 'PUT') return 'bg-amber-100 text-amber-700'
    if (m === 'PATCH') return 'bg-purple-100 text-purple-700'
    if (m === 'DELETE') return 'bg-red-100 text-red-700'
    if (m === 'PAGE') return 'bg-cyan-100 text-cyan-700'
    return 'bg-gray-100 text-gray-700'
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Method</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Endpoint</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {routes.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-4 py-3"><span className={'inline-block px-2 py-0.5 rounded text-xs font-semibold ' + methodColor(r.method)}>{r.method}</span></td>
              <td className="px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200">{r.path}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Card({ title, description, children }: { title: any; description: any; children?: any }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{title}</h4>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{description}</p>
      {children}
    </div>
  )
}

export function Callout({ type = 'info', title, children }) {
  const colors = { info: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20', warning: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20', success: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' }
  return (
    <div className={'rounded-lg border-l-4 p-4 my-4 ' + (colors[type] || colors.info)}>
      <div className="text-base font-bold mb-1 text-gray-900 dark:text-white">{title}</div>
      <div className="text-sm text-gray-700 dark:text-gray-300">{children}</div>
    </div>
  )
}

export function PipelineCard({ stage, actor, description }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{stage}</span>
        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{actor}</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  )
}
