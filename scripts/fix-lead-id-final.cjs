const fs=require('fs')
const edit=(f,fn)=>fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')))
edit('app/chat/[leadId]/page.tsx',s=>s.replace('Number(params.leadId) | undefined','Number(params.leadId)'))
edit('app/crm/assignment-rules/page.tsx',s=>s.replace(/(type DryRunFormState = \{\r?\n  leadId:) number/,'$1 string'))
edit('scripts/import-compliance-feedback.ts',s=>s.replace('existingByLeadId: Map<string,','existingByLeadId: Map<number,'))
edit('scripts/reset-may-2026-discharges.ts',s=>s.replace('function leadRef(id: string)','function leadRef(id: number)').replace('return id.slice(0, 8)','return String(id)'))
edit('process-incoming-leads.ts',s=>s.replace('result.id.substring(0, 8)','String(result.id)'))
edit('app/api/telephony/knowlarity/webhook/route.ts',s=>s.replace("entityId: leadId || customerPhone || 'unknown'","entityId: String(leadId || customerPhone || 'unknown')"))
edit('app/api/telephony/stream/route.ts',s=>s.replace("entityId: leadId || 'call_recording'","entityId: String(leadId || 'call_recording')"))
edit('hooks/use-calendar.ts',s=>s.replace(/(type CaseEvent = \{\r?\n  id:) number/,'$1 string'))
edit('components/outstanding/outstanding-list.tsx',s=>s.replace(/(interface OutstandingCase \{\r?\n  id:) number/,'$1 string'))
edit('components/opd-monitoring/opd-monitoring-page.tsx',s=>s.replace(/(type OpdMonitoringItem = \{\r?\n  id:) number/,'$1 string'))
edit('components/crm/crm-incoming-leads-page.tsx',s=>{
  s=s.replaceAll('formatWholeNumber(sortedRows.length)','formatWholeNumber(totalRows)')
  s=s.replace(/function compareValues\([\s\S]*?\n\}\n\nfunction isWithinDateRange[\s\S]*?\n\}\n/, '')
  s=s.replace(/function getDateOnlyValue\([\s\S]*?\n\}\n/, '')
  s=s.replace(/function getUniqueRowValues\([\s\S]*?\n\}\n/, '')
  s=s.replace(/  const serverPhoneSearch = useMemo\([\s\S]*?\n  \)\n/, '')
  s=s.replace("import { parsePhoneSearchQuery } from '@/lib/phone-search'\n", '')
  return s
})
edit('lib/sync/old-workspace-sync.ts',s=>{
  s=s.replace('PrismaClient, type Prisma,','PrismaClient, Prisma,')
  const keys=['aadharFiles','panFiles','diseasePhotos','otherFiles','documentEditCounts','documentEditHistory']
  s=s.replace('...kypRest,','...kypRest,\n'+keys.map(k=>`            ${k}: kypRest.${k} ?? Prisma.DbNull,`).join('\n'))
  s=s.replace('...preAuthRest,','...preAuthRest,\n              hospitalSuggestions: preAuthRest.hospitalSuggestions ?? Prisma.DbNull,')
  s=s.replace('createdById: remapUserId(createdById, userMap, fallbackUserId)!,\n                ...p,','createdById: remapUserId(createdById, userMap, fallbackUserId)!,\n                ...p,\n                recipients: p.recipients ?? Prisma.DbNull,')
  s=s.replace('...rest,\n            leadId: targetLeadId,\n            requestedById:', '...rest,\n            leadIds: rest.leadIds ?? Prisma.DbNull,\n            attachments: rest.attachments ?? Prisma.DbNull,\n            leadId: targetLeadId,\n            requestedById:')
  // Match CRLF sources too.
  s=s.replace('...rest,\r\n            leadId: targetLeadId,\r\n            requestedById:', '...rest,\n            leadIds: rest.leadIds ?? Prisma.DbNull,\n            attachments: rest.attachments ?? Prisma.DbNull,\n            leadId: targetLeadId,\n            requestedById:')
  s=s.replace(/(userId: remapUserId\(userId, userMap, fallbackUserId\)!,\r?\n            \.\.\.r,)/,'$1\n            metadata: r.metadata ?? Prisma.DbNull,')
  s=s.replace('({ id, leadId: targetLeadId, ...r })),\r\n        })\r\n      }\r\n    },','({ id, leadId: targetLeadId, ...r, inputSnapshot: r.inputSnapshot ?? Prisma.JsonNull, assignmentSnapshot: r.assignmentSnapshot ?? Prisma.DbNull, candidateDiagnostics: r.candidateDiagnostics ?? Prisma.JsonNull })),\r\n        })\r\n      }\r\n    },')
  return s
})
