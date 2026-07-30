/**
 * Seed DocumentTemplate rows from default placeholder bodies.
 * Run: bun prisma/seed-document-templates.ts
 */
import { prisma } from '../lib/prisma'
import {
  DEFAULT_TEMPLATE_BODIES,
  DOCUMENT_TEMPLATE_NAMES,
} from '../lib/hrms/document-default-templates'

const TYPES = Object.keys(DEFAULT_TEMPLATE_BODIES)

async function main() {
  for (const documentType of TYPES) {
    const name = DOCUMENT_TEMPLATE_NAMES[documentType] || documentType
    const contentHtml = DEFAULT_TEMPLATE_BODIES[documentType]

    const existing = await prisma.documentTemplate.findUnique({
      where: { documentType: documentType as any },
    })

    if (!existing) {
      await prisma.documentTemplate.create({
        data: {
          documentType: documentType as any,
          name,
          contentHtml,
        },
      })
      console.log(`✓ created ${documentType}`)
    } else if (!existing.contentHtml?.trim()) {
      await prisma.documentTemplate.update({
        where: { id: existing.id },
        data: { contentHtml, name },
      })
      console.log(`✓ filled ${documentType}`)
    } else {
      console.log(`· skipped ${documentType} (already has content)`)
    }
  }
  console.log('Document templates seeded.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
