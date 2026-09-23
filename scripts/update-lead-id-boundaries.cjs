const fs = require('fs'), path = require('path')
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []) }
for (const file of ['app/api', 'lib', 'hooks', 'components', 'scripts'].flatMap(walk)) {
  const original = fs.readFileSync(file,'utf8')
  let code = original
  code = code.replace(/\b(relatedId|entityId): (leadId|id|lead\.id|params\.leadId|args\.leadId|createdLead\.id|existingLead\.id)([,\r\n])/g, '$1: String($2)$3')
  if (file.startsWith('app')) {
    code = code.replace(/const (leadId|incomingLeadId) = ([\w.]+\.get\(['"](?:leadId|incomingLeadId)['"]\))/g, 'const $1 = optionalLeadId($2)')
    code = code.replace(/const leadId = body\?\.leadId as string \| undefined/g, 'const leadId = optionalLeadId(body?.leadId)')
    code = code.replace(/const (incomingLeadIds|leadIds) = Array\.isArray\(body\.(incomingLeadIds|leadIds)\)[\s\S]*?\n\s*: \[\]/g, 'const $1 = leadIdSchema.array().parse(body.$2 ?? [])')
    if (code.includes('optionalLeadId(') && !code.includes("import { optionalLeadId }")) code = "import { optionalLeadId } from '@/lib/lead-id'\n" + code
    if (code.includes('leadIdSchema.') && !code.includes("import { leadIdSchema }")) code = "import { leadIdSchema } from '@/lib/lead-id'\n" + code
  }
  if (code !== original) fs.writeFileSync(file, code)
}
