import { prisma } from '../lib/prisma'

const RETAIN_COUNT = 1000
const apply = process.argv.includes('--apply')

async function main() {
  const newestRetained = await prisma.lead.findMany({
    orderBy: { id: 'desc' },
    take: RETAIN_COUNT,
    select: { id: true },
  })
  const total = await prisma.lead.count()
  const oldestRetainedId = newestRetained.at(-1)?.id
  const plannedDeleteCount = Math.max(total - newestRetained.length, 0)

  if (!apply) {
    console.log(JSON.stringify({ retainCount: newestRetained.length, oldestRetainedId, plannedDeleteCount, apply: false }))
    return
  }
  if (!oldestRetainedId) {
    console.log(JSON.stringify({ retained: 0, deleted: 0 }))
    return
  }

  // The database enforces every child relationship. This transaction either removes
  // the full old lead record set (including cascade-enabled children) or rolls back.
  const deleted = await prisma.$transaction(async (tx) => tx.lead.deleteMany({
    where: { id: { lt: oldestRetainedId } },
  }), { isolationLevel: 'Serializable' })
  console.log(JSON.stringify({ retained: RETAIN_COUNT, oldestRetainedId, deleted: deleted.count }))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
