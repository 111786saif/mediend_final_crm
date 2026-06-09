import 'dotenv/config'
import { prisma } from '@/lib/prisma'

async function main() {
  const plTotal = await prisma.pLRecord.count()
  const plNoMgr = await prisma.pLRecord.count({
    where: { OR: [{ managerName: null }, { managerName: '' }] },
  })
  const dsTotal = await prisma.dischargeSheet.count()
  const dsNoMgr = await prisma.dischargeSheet.count({
    where: { OR: [{ managerName: null }, { managerName: '' }] },
  })
  console.log('PL records:', plTotal, 'without manager:', plNoMgr)
  console.log('Discharge sheets:', dsTotal, 'without manager:', dsNoMgr)

  const bds = await prisma.user.count({ where: { role: 'BD' } })
  const bdsWithTeam = await prisma.user.count({
    where: {
      role: 'BD',
      employee: { team: { isNot: null } },
    },
  })
  console.log('BDs:', bds, 'with team:', bdsWithTeam)
}

main()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)) })
