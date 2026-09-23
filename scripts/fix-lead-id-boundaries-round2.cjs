const fs = require('fs'), path = require('path')
function edit(f,fn) { const s=fs.readFileSync(f,'utf8'); fs.writeFileSync(f,fn(s)) }
edit('app/api/call-notes/counts/route.ts',s=>"import { parseLeadId } from '@/lib/lead-id'\n"+s.replace('.slice(0, MAX_IDS)','.slice(0, MAX_IDS)\n      .map(parseLeadId)'))
edit('app/api/installments/route.ts',s=>s.replace("body.leadId ? String(body.leadId).trim() : ''",'optionalLeadId(body.leadId)'))
edit('lib/finance/doctor-payoff/mapper.ts',s=>"import { leadIdSchema } from '@/lib/lead-id'\n"+s.replace(/function parseLeadIds\(value: unknown\): string\[\] \{[\s\S]*?\n\}/,`function parseLeadIds(value: unknown): number[] {
  if (value == null) return []
  return leadIdSchema.array().parse(value)
}`))
edit('lib/process-incoming-leads.ts',s=>s.replaceAll('Array<{ id: string; success:', 'Array<{ id: number; success:'))
const scripts=['backfill-all-hospitals','backfill-hospital-doctor','backfill-old-crm-leads','fix-existing-lead-mappings','fix-lead-categories-circles','fix-lead-circles','migrate-lead-pipeline-stages']
for(const name of scripts) edit(`scripts/${name}.ts`,s=>s.replaceAll('cursor: string','cursor: number').replaceAll('id: string','id: number'))
edit('scripts/import-compliance-feedback.ts',s=>s.replace('new Map<string, ComplianceCall>','new Map<number, ComplianceCall>'))
edit('scripts/import-ipd-pnl-csv.ts',s=>s.replace('createdLeadMap = new Map<string, string>','createdLeadMap = new Map<string, number>'))
edit('scripts/reset-may-2026-discharges.ts',s=>s.replace('leadRef = (id: string)','leadRef = (id: number)'))
edit('components/calendar/team-calendar.tsx',s=>s.replace('onCaseClick?.(id)','onCaseClick?.(Number(id))'))
edit('components/kanban-board.tsx',s=>s.replace('l.id === activeId','String(l.id) === activeId').replace('l.id === leadId','String(l.id) === leadId'))
edit('app/pl/dashboard/page.tsx',s=>s.replace("leadId={sheetLeadId ?? ''}",'leadId={sheetLeadId ?? 0}'))
edit('app/pl/outstanding/page.tsx',s=>s.replace("leadId={sheetLeadId ?? ''}",'leadId={sheetLeadId ?? 0}'))
edit('lib/doctor-app/appointments.ts',s=>"import { parseLeadId } from '@/lib/lead-id'\n"+s.replace('id: lead.id,','id: String(lead.id),').replace('loadLead(leadId)','loadLead(parseLeadId(leadId))').replace('loadLead(appointmentId)','loadLead(parseLeadId(appointmentId))').replace('item.id === lead.id','item.id === String(lead.id)').replace('getDoctorAppointmentById(user, leadId)','getDoctorAppointmentById(user, String(leadId))'))
for(const file of ['app/api/outstanding/[id]/route.ts', 'app/api/mobile/v1/appointments/[id]/discharge/route.ts', 'app/api/mobile/v1/appointments/[id]/ipd-surgery-update/route.ts','app/api/mobile/v1/appointments/[id]/prescription/route.ts','app/api/mobile/v1/patients/[id]/history/route.ts']) edit(file,s=>{
  s=s.replace(/const \{ id \} = await params/g,`const { id: rawLeadId } = await params
    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)
    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)
    const id = parsedLeadId.data`)
  return "import { leadIdSchema } from '@/lib/lead-id'\n"+s
})
