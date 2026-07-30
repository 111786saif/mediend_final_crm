'use client'

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { FolderLock, ChevronRight, CornerDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// PermSwitch proxy wrapper
function PermSwitch({ className, ...props }: React.ComponentProps<typeof Switch>) {
  return (
    <Switch
      className={className}
      {...props}
    />
  )
}

interface PermissionsMatrixProps {
  activeModule: any
  editedPermissions: Record<string, { level: string; canGrant: boolean }>
  onToggleModule: (moduleNode: any, checked: boolean) => void
  onToggleSection: (sectionNode: any, checked: boolean) => void
  onUpdatePermission: (resourceId: string, updates: { level: string; canGrant: boolean }) => void
  openSectionKey: string | null
  setOpenSectionKey: (key: string | null) => void
  isRole?: boolean
}

export function PermissionsMatrix({
  activeModule,
  editedPermissions,
  onToggleModule,
  onToggleSection,
  onUpdatePermission,
  openSectionKey,
  setOpenSectionKey,
  isRole = false,
}: PermissionsMatrixProps) {
  return (
    <div className="flex-1 w-full space-y-4">
      {/* Active Module Header */}
      <div className="bg-card text-card-foreground border border-border rounded-xl p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <FolderLock className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">{activeModule.label} Module</h3>
            <p className="text-xs text-muted-foreground">Configure functional visibility rules under this module category.</p>
          </div>
        </div>

        {/* Grant All Module Switch */}
        <div className="flex items-center gap-2 bg-muted/50 border border-border px-4 py-2 rounded-full self-start sm:self-auto">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Grant Module</span>
          <PermSwitch
            checked={activeModule.children?.every((sec: any) => {
              const sVal = editedPermissions[sec.id]
              return sVal && sVal.level === 'FULL_ACCESS'
            }) ?? false}
            onCheckedChange={(checked) => onToggleModule(activeModule, checked)}
          />
        </div>
      </div>

      {/* Sections Accordions */}
      <div className="space-y-4">
        {activeModule.children?.map((sec: any) => {
          const isOpen = !isRole && openSectionKey === sec.key
          const isSectionGranted = editedPermissions[sec.id]?.level !== 'NONE'

          return (
            <div
              key={sec.key}
              className="border border-border rounded-xl bg-card text-card-foreground shadow-sm overflow-hidden transition-all duration-200"
            >
              {/* Accordion Trigger Header */}
              <div
                className={cn(
                  "flex items-center justify-between p-4 bg-muted/40 select-none",
                  !isRole && "cursor-pointer hover:bg-muted/70"
                )}
                onClick={() => {
                  if (!isRole) {
                    setOpenSectionKey(isOpen ? null : sec.key)
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  {!isRole && (
                    <ChevronRight className={`h-4 w-4 text-cyan-600 dark:text-cyan-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                  )}
                  <span className="font-semibold text-lg text-foreground">{sec.label}</span>
                </div>
                <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Grant Section</span>
                    <PermSwitch
                      checked={isSectionGranted}
                      onCheckedChange={(checked) => onToggleSection(sec, checked)}
                    />
                  </div>
                </div>
              </div>

              {/* Accordion Content Grid */}
              {isOpen && (
                <div className="p-4 border-t border-border bg-background space-y-1">
                  {/* Table Header Row */}
                  <div className="grid grid-cols-12 gap-4 py-3.5 px-4 text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                    <div className="col-span-4">Access Node / Entity</div>
                    <div className="col-span-2 text-center">Read</div>
                    <div className="col-span-2 text-center">Write</div>
                    <div className="col-span-2 text-center">Delete</div>
                    <div className="col-span-2 text-center">Delegate</div>
                  </div>

                  {/* Child Actions / Sections Rows */}
                  {sec.children?.map((child: any) => {
                    const current = editedPermissions[child.id] || { level: 'NONE', canGrant: false }
                    const isRead = current.level !== 'NONE'
                    const isWrite = current.level === 'READ_WRITE' || current.level === 'READ_WRITE_DELETE' || current.level === 'FULL_ACCESS'
                    const isDelete = current.level === 'READ_WRITE_DELETE' || current.level === 'FULL_ACCESS'
                    const isDelegate = current.canGrant === true

                    const hasSubChildren = child.children && child.children.length > 0

                    return (
                      <React.Fragment key={child.id}>
                        {/* Level 2 Sub-section Row */}
                        <div className="grid grid-cols-12 gap-4 py-4 px-4 hover:bg-muted/50 rounded-lg items-center transition-all border-b border-border">
                          <div className="col-span-4 text-base pl-6 text-foreground flex items-center gap-1.5 font-medium">
                            {child.label}
                          </div>
                          <div className="col-span-2 flex justify-center">
                            <PermSwitch
                              checked={isRead}
                              onCheckedChange={(checked) => {
                                const newLevel = checked ? 'READ' : 'NONE'
                                onUpdatePermission(child.id, {
                                  level: newLevel,
                                  canGrant: checked ? current.canGrant : false
                                })
                              }}
                            />
                          </div>
                          <div className="col-span-2 flex justify-center">
                            <PermSwitch
                              checked={isWrite}
                              disabled={!isRead}
                              onCheckedChange={(checked) => {
                                const newLevel = checked ? 'READ_WRITE' : 'READ'
                                onUpdatePermission(child.id, { ...current, level: newLevel })
                              }}
                            />
                          </div>
                          <div className="col-span-2 flex justify-center">
                            <PermSwitch
                              checked={isDelete}
                              disabled={!isWrite}
                              onCheckedChange={(checked) => {
                                const newLevel = checked ? 'FULL_ACCESS' : 'READ_WRITE'
                                onUpdatePermission(child.id, { ...current, level: newLevel })
                              }}
                            />
                          </div>
                          <div className="col-span-2 flex justify-center">
                            <PermSwitch
                              checked={isDelegate}
                              disabled={!isRead}
                              onCheckedChange={(checked) => {
                                onUpdatePermission(child.id, { ...current, canGrant: checked })
                              }}
                            />
                          </div>
                        </div>

                        {/* Level 3 Columns / Cards Rows */}
                        {hasSubChildren && child.children.map((subChild: any) => {
                          const subCurrent = editedPermissions[subChild.id] || { level: 'NONE', canGrant: false }
                          const subIsRead = subCurrent.level !== 'NONE'
                          const subIsWrite = subCurrent.level === 'READ_WRITE' || subCurrent.level === 'READ_WRITE_DELETE' || subCurrent.level === 'FULL_ACCESS'
                          const subIsDelete = subCurrent.level === 'READ_WRITE_DELETE' || subCurrent.level === 'FULL_ACCESS'
                          const subIsDelegate = subCurrent.canGrant === true

                          return (
                            <div key={subChild.id} className="grid grid-cols-12 gap-4 py-3 px-4 hover:bg-muted/40 rounded-lg items-center transition-all border-b border-border/50">
                              <div className="col-span-4 text-sm pl-12 text-muted-foreground flex items-center gap-2">
                                <CornerDownRight className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                                <span>{subChild.label}</span>
                              </div>
                              <div className="col-span-2 flex justify-center">
                                <PermSwitch
                                  checked={subIsRead}
                                  onCheckedChange={(checked) => {
                                    const newLevel = checked ? 'READ' : 'NONE'
                                    onUpdatePermission(subChild.id, {
                                      level: newLevel,
                                      canGrant: checked ? subCurrent.canGrant : false
                                    })
                                  }}
                                />
                              </div>
                              <div className="col-span-2 flex justify-center">
                                <PermSwitch
                                  checked={subIsWrite}
                                  disabled={!subIsRead}
                                  onCheckedChange={(checked) => {
                                    const newLevel = checked ? 'READ_WRITE' : 'READ'
                                    onUpdatePermission(subChild.id, { ...subCurrent, level: newLevel })
                                  }}
                                />
                              </div>
                              <div className="col-span-2 flex justify-center">
                                <PermSwitch
                                  checked={subIsDelete}
                                  disabled={!subIsWrite}
                                  onCheckedChange={(checked) => {
                                    const newLevel = checked ? 'FULL_ACCESS' : 'READ_WRITE'
                                    onUpdatePermission(subChild.id, { ...subCurrent, level: newLevel })
                                  }}
                                />
                              </div>
                              <div className="col-span-2 flex justify-center">
                                <PermSwitch
                                  checked={subIsDelegate}
                                  disabled={!subIsRead}
                                  onCheckedChange={(checked) => {
                                    onUpdatePermission(subChild.id, { ...subCurrent, canGrant: checked })
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
