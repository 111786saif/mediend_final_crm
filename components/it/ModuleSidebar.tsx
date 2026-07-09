'use client'

import { Settings } from 'lucide-react'

interface ModuleSidebarProps {
  modules: any[]
  selectedModuleKey: string | null
  onSelectModule: (key: string) => void
}

export function ModuleSidebar({
  modules,
  selectedModuleKey,
  onSelectModule,
}: ModuleSidebarProps) {
  return (
    <aside className="w-full lg:w-80 flex-shrink-0 bg-[#151e3c]/40 border border-[#283150] rounded-xl overflow-hidden p-2 space-y-1 lg:sticky lg:top-[185px]">
      <div className="p-3 border-b border-[#283150]/60 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Access Modules</span>
      </div>
      {modules.map((mod: any) => {
        const isActive = mod.key === selectedModuleKey
        return (
          <button
            key={mod.key}
            onClick={() => onSelectModule(mod.key)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl text-left text-lg transition-all ${
              isActive
                ? 'bg-[#6366f1]/20 text-[#2fd9f4] border border-[#6366f1]/30 font-bold'
                : 'text-[#c7c6cd] hover:bg-[#1f2847]/40 hover:text-white'
            }`}
          >
            <Settings className={`h-6 w-6 ${isActive ? 'text-[#2fd9f4]' : 'text-[#919097]'}`} />
            <span>{mod.label}</span>
          </button>
        )
      })}
    </aside>
  )
}
