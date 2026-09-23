const fs = require('fs')
const schema = fs.readFileSync('.task-checks/schema-before.prisma', 'utf8')
fs.writeFileSync('prisma/legacy-source.prisma', '// Read-only schema for imports from the pre-integer-ID workspace.\n' + schema.replace('../generated/prisma','../generated/legacy-source'))
const file = 'lib/sync/old-workspace-sync.ts'
let code = fs.readFileSync(file,'utf8')
code = "import { PrismaClient as LegacyPrismaClient } from '@/generated/legacy-source/client'\n" + code
code = code.replace('export type WorkspacePrisma = PrismaClient','export type WorkspacePrisma = PrismaClient\nexport type LegacyWorkspacePrisma = LegacyPrismaClient\nexport type ReadonlyWorkspacePrisma = Pick<PrismaClient, \'$queryRaw\' | \'$queryRawUnsafe\'>')
code = code.replace('createSourcePrisma(): WorkspacePrisma','createSourcePrisma(): LegacyWorkspacePrisma')
code = code.replace('return new PrismaClient({','return new LegacyPrismaClient({')
code = code.replaceAll('source: WorkspacePrisma','source: LegacyWorkspacePrisma')
code = code.replaceAll('db: WorkspacePrisma','db: ReadonlyWorkspacePrisma')
code = code.replace('WeakMap<WorkspacePrisma,','WeakMap<ReadonlyWorkspacePrisma,')
code = code.replace('sourceLeadId: number','sourceLeadId: string')
code = code.replace(/(async function buildLeadCreateFromSourceRow[\s\S]*?leadId:) number/,'$1 string')
code = code.replace('    id: leadId,\n    leadRef,', '    legacyId: leadId,\n    leadRef,').replace('    id: leadId,\r\n    leadRef,', '    legacyId: leadId,\r\n    leadRef,')
code = code.replace('const targetLeadId = isCreate ? sourceLeadData.id : targetLead!.id','let targetLeadId = targetLead?.id ?? 0')
code = code.replace('await tx.lead.create({ data: leadCreate! })','targetLeadId = (await tx.lead.create({ data: leadCreate! })).id')
fs.writeFileSync(file,code)
const compare='lib/sync/export-lead-compare.ts'
fs.writeFileSync(compare,fs.readFileSync(compare,'utf8').replaceAll('WorkspacePrisma','ReadonlyWorkspacePrisma'))
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
pkg.scripts['db:generate:legacy']='prisma generate --schema prisma/legacy-source.prisma'
pkg.scripts['db:generate']='prisma generate && prisma generate --schema prisma/legacy-source.prisma'
pkg.scripts.build='bun run db:generate && next build --webpack'
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n')
fs.appendFileSync('.gitignore','\n# Generated read-only client for legacy-workspace imports\n/generated/legacy-source/\n/.task-checks/\n/.lead-pagination-baseline.log\n')
