const fs = require('fs'), path = require('path')
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []) }
function edit(file, fn) { const s=fs.readFileSync(file,'utf8'); const out=fn(s); if(out!==s) fs.writeFileSync(file,out) }
for (const file of ['app','components','hooks','lib','scripts'].flatMap(walk)) edit(file, s => {
  s=s.replace(/\b(selectedLeadIds|duplicateLeadId|sourceLeadId|selectedLeadId)(\??:\s*)string\b/g, '$1$2number')
  s=s.replace(/(\[(?:selectedLeads|optimisticallyOpenedLeadIds),[^\]]+\] = useState)<string\[\]>/g, '$1<number[]>')
  s=s.replace(/(\[(?:sheetLeadId|quickViewLeadId|expandedRemarksLeadId),[^\]]+\] = useState)<string \| null>/g, '$1<number | null>')
  s=s.replace(/(const (?:paidByLead|byLead) = new Map)<string,/g, '$1<number | null,')
  s=s.replace(/(relatedId|entityId): ([\w.]+\.leadId)([,\r\n])/g, '$1: String($2)$3')
  s=s.replace('entityId: lead.id }', 'entityId: String(lead.id) }').replace('log.entityId !== lead.id','log.entityId !== String(lead.id)')
  s=s.replace(/optionalLeadId\(([^\n]+)\)\?\.trim\(\)/g,'optionalLeadId($1)')
  if (/app[\\/](?:patient|pl|chat)[\\/]\[leadId\]|app[\\/]pl[\\/](?:outstanding|record)[\\/]\[leadId\]/.test(file)) {
    s=s.replace(/const leadId = params\.leadId as string/g, 'const leadId = Number(params.leadId)')
  }
  return s
})
edit('lib/case-permissions.ts', s=>s.replace('interface Lead {\r\n  id: string','interface Lead {\r\n  id: number'))
for(const [file,name] of [['lib/case-calendar-events.ts','CaseEvent'],['lib/opd-monitoring.ts','MonitoringAppointment'],['lib/finance/doctor-payoff/types.ts','DoctorPayoffRequestRecord']]) edit(file,s=>s.replace(new RegExp(`(${name} =? ?\\{\\r?\\n  id:) number`),'$1 string'))
edit('lib/incoming-leads/manual-assign.ts',s=>s.replace(/(type IncomingLeadForManualAssign = \{\r?\n  id:) string/,'$1 number'))
edit('lib/lead-qr.ts',s=>s.replace('loadLeadForQrAudit(id: string)','loadLeadForQrAudit(id: number)'))
for(const file of ['app/api/leads/[id]/opened/route.ts','app/api/leads/[id]/make-call/route.ts','app/api/leads/[id]/qr-call/route.ts']) edit(file,s=>s.replace(/(authorizeLeadAccess\(request: NextRequest, id:) string/,'$1 number'))
edit('hooks/use-invoice-requests.ts',s=>s.replace("params.set('leadId', filters.leadId)","params.set('leadId', String(filters.leadId))"))
edit('hooks/use-leads.ts',s=>s.replace('{ id: string; data: Partial<Lead> }','{ id: number; data: Partial<Lead> }'))
edit('components/pipeline/sales-pipeline-page.tsx',s=>s.replace(/(\(id:) string/g,'$1 number'))
edit('app/crm/assignment-rules/page.tsx',s=>s.replace('leadId: number','leadId: string'))
for(const file of ['app/doctors/[name]/page.tsx','app/hospitals/[name]/page.tsx']) edit(file,s=>s.replace('new Map<string, DoctorPayoffRequestRecord>','new Map<number, DoctorPayoffRequestRecord>').replace('new Map<string, InvoiceRequestRecord>','new Map<number, InvoiceRequestRecord>'))
edit('app/insurance/cash-cases/page.tsx',s=>s.replace('new Map<string, LeadWithStage>','new Map<number, LeadWithStage>'))
edit('lib/lead-bulk-reassign/server.ts',s=>"import { leadIdSchema } from '@/lib/lead-id'\n"+s.replace('normalizeOrderedIds(input.leadIds)','[...new Set(leadIdSchema.array().parse(input.leadIds))]').replace("parseStoredIdArray(run.leadIds, 'leadIds')",'leadIdSchema.array().parse(run.leadIds)'))
edit('app/api/leads/bulk-reassign/route.ts',s=>"import { leadIdSchema } from '@/lib/lead-id'\n"+s.replace(/leadIds: Array\.isArray\(body.leadIds\)[\s\S]*?: \[\],/,'leadIds: leadIdSchema.array().parse(body.leadIds ?? []),'))
edit('lib/lead-opd-mutations.ts',s=>s.replace('legacyLeadId !== input.leadId','Number(legacyLeadId) !== input.leadId'))
