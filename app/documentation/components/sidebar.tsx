'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Menu, X, ChevronRight, Book, Users, DollarSign, ShoppingCart, Shield, TrendingUp, AlertCircle, GitBranch, Code, Database } from 'lucide-react'

interface DocSection {
  id: string
  label: string
  icon: React.ReactNode
  children?: { id: string; label: string }[]
}

const sections: DocSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: <Book className="h-4 w-4" />,
    children: [
      { id: 'getting-started', label: 'Getting Started' },
      { id: 'roles-permissions', label: 'Roles & Permissions' },
      { id: 'architecture', label: 'Architecture' },
    ],
  },
  {
    id: 'sales-insurance',
    label: 'Sales & Insurance',
    icon: <Shield className="h-4 w-4" />,
    children: [
      { id: 'patient-flow', label: 'Patient Case Flow' },
      { id: 'sales-module', label: 'Sales Pipeline' },
      { id: 'kyp-module', label: 'KYP (Know Your Patient)' },
      { id: 'pre-auth', label: 'Pre-Authorization' },
      { id: 'insurance-dashboard', label: 'Insurance Dashboard' },
      { id: 'cash-flow', label: 'Cash Flow' },
    ],
  },
  {
    id: 'hrms',
    label: 'HRMS',
    icon: <Users className="h-4 w-4" />,
    children: [
      { id: 'hrms-employees', label: 'Employee Management' },
      { id: 'hrms-attendance', label: 'Attendance System' },
      { id: 'hrms-leaves', label: 'Leave Management' },
      { id: 'hrms-payroll', label: 'Payroll' },
      { id: 'hrms-recruitment', label: 'Recruitment' },
      { id: 'hrms-performance', label: 'Performance & Feedback' },
      { id: 'hrms-documents', label: 'Documents' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: <DollarSign className="h-4 w-4" />,
    children: [
      { id: 'finance-ledger', label: 'Ledger & Accounting' },
      { id: 'finance-projects', label: 'Projects & Inventory' },
      { id: 'finance-parties', label: 'Parties & Heads' },
      { id: 'finance-payroll', label: 'Finance Payroll' },
    ],
  },
  {
    id: 'pl',
    label: 'P&L (Profit & Loss)',
    icon: <TrendingUp className="h-4 w-4" />,
    children: [
      { id: 'pl-dashboard', label: 'P&L Dashboard' },
      { id: 'pl-record', label: 'P&L Record Entry' },
      { id: 'pl-surgery', label: 'Surgery P&L' },
    ],
  },
  {
    id: 'outstanding',
    label: 'Outstanding',
    icon: <AlertCircle className="h-4 w-4" />,
    children: [
      { id: 'outstanding-dashboard', label: 'Outstanding Dashboard' },
      { id: 'outstanding-edit', label: 'Edit Outstanding' },
    ],
  },
  {
    id: 'processes',
    label: 'Processes',
    icon: <GitBranch className="h-4 w-4" />,
    children: [
      { id: 'insurance-process', label: 'Insurance Flow Process' },
      { id: 'cash-process', label: 'Cash Flow Process' },
      { id: 'pl-process', label: 'P&L Process' },
      { id: 'outstanding-process', label: 'Outstanding Process' },
    ],
  },
  {
    id: 'api-reference',
    label: 'API Reference',
    icon: <Code className="h-4 w-4" />,
    children: [
      { id: 'api-auth', label: 'Authentication' },
      { id: 'api-leads', label: 'Leads & Sales' },
      { id: 'api-kyp', label: 'KYP Module' },
      { id: 'api-insurance', label: 'Insurance' },
      { id: 'api-discharge', label: 'Discharge & P&L' },
      { id: 'api-hrms', label: 'HRMS' },
      { id: 'api-finance', label: 'Finance' },
      { id: 'api-analytics', label: 'Analytics' },
      { id: 'api-master', label: 'Master Data' },
      { id: 'api-other', label: 'Other APIs' },
    ],
  },
  {
    id: 'frontend',
    label: 'Frontend',
    icon: <ShoppingCart className="h-4 w-4" />,
    children: [
      { id: 'fe-structure', label: 'Structure & Tech Stack' },
      { id: 'fe-components', label: 'Key Components' },
      { id: 'fe-navigation', label: 'Navigation System' },
      { id: 'fe-state', label: 'State Management' },
    ],
  },
  {
    id: 'mysql-sync-group',
    label: 'MySQL Sync',
    icon: <Database className="h-4 w-4" />,
    children: [
      { id: 'mysql-sync', label: 'Legacy Database Sync' },
    ],
  },
]

interface DocumentationSidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
}

export function DocumentationSidebar({ activeSection, onSectionChange }: DocumentationSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    'sales-insurance': true,
    hrms: true,
    finance: true,
    pl: true,
    outstanding: true,
    processes: true,
    'api-reference': true,
    frontend: true,
  })

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform duration-200 ease-in-out md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mediend CRM</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Documentation v2</p>
        </div>

        <nav className="overflow-y-auto h-[calc(100vh-90px)] pb-8">
          {sections.map((section) => (
            <div key={section.id} className="border-b border-gray-100 dark:border-gray-800">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-6 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {section.icon}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 text-left">{section.label}</span>
                <ChevronRight
                  className={cn(
                    'h-3 w-3 text-gray-400 transition-transform',
                    expandedSections[section.id] ? 'rotate-90' : ''
                  )}
                />
              </button>

              {expandedSections[section.id] && section.children && (
                <div className="pb-2">
                  {section.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => {
                        onSectionChange(child.id)
                        setIsOpen(false)
                      }}
                      className={cn(
                        'w-full px-10 py-2 text-sm flex items-center gap-2 transition-colors',
                        activeSection === child.id
                          ? 'text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-600'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      )}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
