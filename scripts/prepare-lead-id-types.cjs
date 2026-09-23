const fs = require('fs')
const path = 'prisma/schema.prisma'
let schema = fs.readFileSync(path, 'utf8')
schema = schema.replace(/(model (?:Lead|IncomingLead) \{\r?\n\s+id\s+)String\s+@id @default\(cuid\(\)\)/g, '$1Int @id @default(autoincrement())\n  legacyId String? @unique')
schema = schema.replace(/(\n\s+(?:leadId|processedLeadId)\s+)String/g, '$1Int')
fs.writeFileSync(path, schema)
