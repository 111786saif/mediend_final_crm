const fs = require('fs'), path = require('path'), ts = require('typescript')
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []) }
for (const file of ['app', 'lib', 'hooks', 'components', 'workers', 'scripts'].flatMap(walk)) {
  const original = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true)
  const edits = []
  function visit(node) {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node)) {
      const members = node.members
      const names = members.filter(m => m.name).map(m => m.name.getText(sf))
      const name = node.name?.getText(sf) || node.parent.name?.getText(sf) || ''
      const isLead = (names.includes('patientName') || names.includes('leadRef') || ['IncomingLeadRecord', 'IncomingLeadTableRow', 'LeadPreviewSeed', 'SelectedIncomingLead', 'SelectedLead', 'LegacyLeadOpdSource'].includes(name) || ['lead', 'processedLead'].includes(name))
      if (isLead) {
        const id = members.find(m => m.name?.getText(sf) === 'id' && m.type?.kind === ts.SyntaxKind.StringKeyword)
        if (id) edits.push([id.type.getStart(sf), id.type.end, 'number'])
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  let code = original
  for (const [start, end, text] of edits.sort((a,b) => b[0]-a[0])) code = code.slice(0,start)+text+code.slice(end)
  // Next.js path parameters are strings even when the database key is an integer.
  code = code.replace(/params: Promise<\{ leadId: number/g, 'params: Promise<{ leadId: string')
  if (/app[\\/]api[\\/].*\[leadId\]/.test(file)) {
    code = code.replace(/const \{ leadId(, [^}]+)? \} = await params/g, (_, rest='') => `const { leadId: rawLeadId${rest} } = await params\n    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)\n    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)\n    const leadId = parsedLeadId.data`)
    if (code.includes('leadIdSchema') && !code.includes("from '@/lib/lead-id'")) code = "import { leadIdSchema } from '@/lib/lead-id'\n" + code
  }
  // Numeric selections are retained as numbers; string-only UI controls convert at their boundary.
  code = code.replace(/(\[(?:selectedLeadIds|selectedManualAssignLeadIds|selectedRetryLeadIds),[^\]]+\] = useState)<string\[\]>/g, '$1<number[]>')
  code = code.replace(/(\[(?:selectedLeadId|selectedLeadIdForRemarks|selectedLeadIdForEdit|editingLeadId|callingLeadId|loadingLeadId),[^\]]+\] = useState)<string \| null>/g, '$1<number | null>')
  if (code !== original) fs.writeFileSync(file, code)
}
const file = 'components/pipeline/sales-pipeline-page.tsx'
let code = fs.readFileSync(file, 'utf8')
const start = code.indexOf('  // Prefetch next page')
const end = code.indexOf('  // -----------------------------------------------------------------------', start)
if (start !== -1 && end !== -1) { code = code.slice(0, start) + code.slice(end); fs.writeFileSync(file, code) }
