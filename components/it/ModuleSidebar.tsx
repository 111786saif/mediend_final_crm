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
    <aside className="w-full lg:w-80 flex-shrink-0 bg-card text-card-foreground border border-border rounded-xl shadow-sm overflow-hidden p-2 space-y-1 lg:sticky lg:top-[185px]">
      <div className="p-3 border-b border-border mb-2">
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
                ? 'bg-primary/10 text-primary border border-primary/30 font-bold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Settings className={`h-6 w-6 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <span>{mod.label}</span>
          </button>
        )
      })}
    </aside>
  )
}
