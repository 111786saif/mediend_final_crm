const fs = require('fs')
const path = require('path')
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : [])
}
for (const file of ['app', 'lib', 'hooks', 'components', 'workers', 'scripts'].flatMap(walk)) {
  let code = fs.readFileSync(file, 'utf8')
  const original = code
  code = code.replace(/\b(leadId|incomingLeadId|processedLeadId|excludeLeadId|excludeIncomingLeadId|targetLeadId)(\??:\s*)string\b/g, '$1$2number')
  code = code.replace(/\b(leadIds|incomingLeadIds)(\??:\s*)string\[\]/g, '$1$2number[]')
  code = code.replace(/\b(leadId|incomingLeadId|processedLeadId): z\.string\(\)(?:\.trim\(\))?(?:\.min\(1\))?/g, '$1: leadIdSchema')
  code = code.replace(/\b(leadIds|incomingLeadIds): z\.array\(z\.string\(\)(?:\.min\(1\))?\)/g, '$1: z.array(leadIdSchema)')
  if (code.includes('leadIdSchema') && !original.includes('leadIdSchema')) code = "import { leadIdSchema } from '@/lib/lead-id'\n" + code
  // Route parameters remain strings at the HTTP boundary; validate before database use.
  if (/app[\\/]api[\\/](?:leads|crm[\\/]incoming-leads)[\\/]\[id\]/.test(file)) {
    code = code.replace(/const \{ id(, [^}]+)? \} = await params/g, (_, rest = '') => `const { id: rawLeadId${rest} } = await params\n    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)\n    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)\n    const id = parsedLeadId.data`)
    code = code.replace(/const \{ id: leadId(, [^}]+)? \} = await params/g, (_, rest = '') => `const { id: rawLeadId${rest} } = await params\n    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)\n    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)\n    const leadId = parsedLeadId.data`)
    if (code.includes('leadIdSchema') && !code.includes("from '@/lib/lead-id'")) code = "import { leadIdSchema } from '@/lib/lead-id'\n" + code
  }
  if (code !== original) fs.writeFileSync(file, code)
}
