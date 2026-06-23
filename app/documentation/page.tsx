// @ts-nocheck
'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { DocumentationSidebar } from './components/sidebar'
import { Section } from './components/docs-components'
import { overviewSections } from './content/overview'
import { salesInsuranceSections } from './content/sales-insurance'
import { hrmsSections } from './content/hrms'
import { financeSections } from './content/finance'
import { plSections, outstandingSections } from './content/pl-outstanding'
import { processSections } from './content/processes'
import { apiSections } from './content/api-reference'
import { frontendSections } from './content/frontend'
import { mysqlSyncSection } from './content/mysql-sync'

const allSections = {
  ...overviewSections,
  ...salesInsuranceSections,
  ...hrmsSections,
  ...financeSections,
  ...plSections,
  ...outstandingSections,
  ...processSections,
  ...apiSections,
  ...frontendSections,
  ...mysqlSyncSection,
}

export default function DocumentationPage() {
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [pinError, setPinError] = useState(false)
  const [activeSection, setActiveSection] = useState('getting-started')
  const [searchQuery, setSearchQuery] = useState('')
  const PIN = 'mediend@2026'

  useEffect(() => {
    if (unlocked && !searchQuery.trim()) {
      const el = document.getElementById(activeSection)
      el?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [unlocked, activeSection, searchQuery])

  const searchTerm = searchQuery.toLowerCase().trim()

  const displayedSections = useMemo(() => {
    if (!searchTerm) return Object.keys(allSections)
    return Object.keys(allSections).filter((k) => {
      const s = allSections[k]
      if (!s) return false
      return k.toLowerCase().includes(searchTerm) || s.title.toLowerCase().includes(searchTerm)
    })
  }, [allSections, searchTerm])

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Mediend CRM</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enter the documentation PIN to continue</p>
          <input
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setPinError(false) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (pin === PIN) setUnlocked(true)
                else setPinError(true)
              }
            }}
            className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />
          {pinError && <p className="text-sm text-red-500 mb-4">Incorrect PIN. Try again.</p>}
          <button
            onClick={() => { if (pin === PIN) setUnlocked(true); else setPinError(true) }}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Unlock
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-950'>
      <DocumentationSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <div className='md:ml-72'>
        <div className='sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 backdrop-blur-sm'>
          <div className='max-w-4xl mx-auto px-6 py-4'>
            <div className='flex items-center justify-between mb-2'>
              <div className='text-2xl font-bold text-gray-900 dark:text-white'>Mediend CRM Documentation</div>
              <input type='text' placeholder='Search...' value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className='w-64 px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500' />
            </div>
            <div className='text-xs text-gray-500'>Click sidebar to navigate. Search across all sections.</div>
          </div>
        </div>
        <div className='max-w-4xl mx-auto px-6 py-8 space-y-12'>
          {searchTerm && <div className='text-sm text-gray-500'>Showing {displayedSections.length} section{displayedSections.length !== 1 ? 's' : ''}</div>}
          {displayedSections.map(k => {
            const s = allSections[k]
            return s ? <Section key={k} id={k} title={s.title}><s.Component /></Section> : null
          })}
        </div>
        <div className='mx-6 pb-8 border-t pt-8 max-w-4xl'>
          <a href='/login' className='inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700'>Go to Login</a>
        </div>
      </div>
    </div>
  )
}
