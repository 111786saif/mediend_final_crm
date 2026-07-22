import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pkg from 'pg'

const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Treatment data from ATS.txt
const treatments = [
  { name: 'Rhinoplasty', category: 'Cosmetic', atsNewDelhi: 120000, atsMumbai: 130000, atsPune: 130000, atsHyderabad: 150000, atsBangalore: 150000 },
  { name: 'Septoplasty', category: 'Cosmetic', atsNewDelhi: 120000, atsMumbai: 130000, atsPune: 150000, atsHyderabad: 150000, atsBangalore: 150000 },
  { name: 'Septorhinoplasty', category: 'Cosmetic', atsNewDelhi: 130000, atsMumbai: 130000, atsPune: 150000, atsHyderabad: 150000, atsBangalore: 150000 },
  { name: 'Gynecomastia-Grade 1', category: 'Cosmetic', atsNewDelhi: 40000, atsMumbai: 45000, atsPune: 40000, atsHyderabad: 45000, atsBangalore: 45000 },
  { name: 'Gynecomastia-Grade 2', category: 'Cosmetic', atsNewDelhi: 42000, atsMumbai: 45000, atsPune: 42000, atsHyderabad: 45000, atsBangalore: 45000 },
  { name: 'Gynecomastia-Grade 3', category: 'Cosmetic', atsNewDelhi: 50000, atsMumbai: 50000, atsPune: 50000, atsHyderabad: 50000, atsBangalore: 50000 },
  { name: 'Gynecomastia-Grade 4', category: 'Cosmetic', atsNewDelhi: 60000, atsMumbai: 60000, atsPune: 60000, atsHyderabad: 60000, atsBangalore: 60000 },
  { name: 'Auxiliary Breast', category: 'Cosmetic', atsNewDelhi: 45000, atsMumbai: 45000, atsPune: 45000, atsHyderabad: 45000, atsBangalore: 45000 },
  { name: 'Chin Liposuction', category: 'Cosmetic', atsNewDelhi: 60000, atsMumbai: 70000, atsPune: 70000, atsHyderabad: 70000, atsBangalore: 70000 },
  { name: 'Buccal Fat Removal', category: 'Cosmetic', atsNewDelhi: 60000, atsMumbai: 70000, atsPune: 70000, atsHyderabad: 70000, atsBangalore: 70000 },
  { name: 'Chin Implant', category: 'Cosmetic', atsNewDelhi: 75000, atsMumbai: 85000, atsPune: 85000, atsHyderabad: 95000, atsBangalore: 95000 },
  { name: 'Tummy Liposuction', category: 'Cosmetic', atsNewDelhi: 120000, atsMumbai: 130000, atsPune: 130000, atsHyderabad: 130000, atsBangalore: 130000 },
  { name: 'Tummy Tuck and Tummy Liposuction', category: 'Cosmetic', atsNewDelhi: 150000, atsMumbai: 150000, atsPune: 150000, atsHyderabad: 150000, atsBangalore: 150000 },
  { name: 'Breast Reduction Normal', category: 'Cosmetic', atsNewDelhi: 90000, atsMumbai: 130000, atsPune: 130000, atsHyderabad: 150000, atsBangalore: 150000 },
  { name: 'Breast Reduction Fat Removal Only', category: 'Cosmetic', atsNewDelhi: 100000, atsMumbai: 140000, atsPune: 140000, atsHyderabad: 140000, atsBangalore: 140000 },
  { name: 'Breast Implant', category: 'Cosmetic', atsNewDelhi: 150000, atsMumbai: 150000, atsPune: 150000, atsHyderabad: 150000, atsBangalore: 150000 },
  { name: '360° Liposuction', category: 'Cosmetic', atsNewDelhi: 180000, atsMumbai: 200000, atsPune: 200000, atsHyderabad: 200000, atsBangalore: 200000 },
  { name: 'Thigh Liposuction', category: 'Cosmetic', atsNewDelhi: 120000, atsMumbai: 130000, atsPune: 130000, atsHyderabad: 130000, atsBangalore: 130000 },
  { name: 'Biceps Liposuction', category: 'Cosmetic', atsNewDelhi: 120000, atsMumbai: 120000, atsPune: 120000, atsHyderabad: 120000, atsBangalore: 120000 },
  { name: 'Butt Liposuction', category: 'Cosmetic', atsNewDelhi: 130000, atsMumbai: 120000, atsPune: 130000, atsHyderabad: 130000, atsBangalore: 130000 },
  { name: 'Butt Implant', category: 'Cosmetic', atsNewDelhi: 150000, atsMumbai: 150000, atsPune: 150000, atsHyderabad: 150000, atsBangalore: 150000 },
  { name: 'Back Liposuction', category: 'Cosmetic', atsNewDelhi: 120000, atsMumbai: 110000, atsPune: 120000, atsHyderabad: 120000, atsBangalore: 120000 },
  { name: 'Ganglion Cyst', category: 'Cosmetic', atsNewDelhi: 25000, atsMumbai: 25000, atsPune: 25000, atsHyderabad: 25000, atsBangalore: 25000 },
  { name: 'Lipoma & Cyst 1-10', category: 'Cosmetic', atsNewDelhi: 25000, atsMumbai: 25000, atsPune: 25000, atsHyderabad: 25000, atsBangalore: 25000 },
  { name: 'Lipoma & Cyst 11-20', category: 'Cosmetic', atsNewDelhi: 50000, atsMumbai: 50000, atsPune: 50000, atsHyderabad: 50000, atsBangalore: 50000 },
  { name: 'Lipoma & Cyst 21-30', category: 'Cosmetic', atsNewDelhi: 70000, atsMumbai: 70000, atsPune: 70000, atsHyderabad: 70000, atsBangalore: 70000 },
  { name: 'Lipoma & Cyst 31-40', category: 'Cosmetic', atsNewDelhi: 90000, atsMumbai: 90000, atsPune: 90000, atsHyderabad: 90000, atsBangalore: 90000 },
  { name: 'Lipoma & Cyst 41-50', category: 'Cosmetic', atsNewDelhi: 120000, atsMumbai: 120000, atsPune: 120000, atsHyderabad: 120000, atsBangalore: 120000 },
  { name: 'Lipoma & Cyst 51-60', category: 'Cosmetic', atsNewDelhi: 130000, atsMumbai: 130000, atsPune: 130000, atsHyderabad: 130000, atsBangalore: 130000 },
  { name: 'Lipoma & Cyst 61-70', category: 'Cosmetic', atsNewDelhi: 140000, atsMumbai: 140000, atsPune: 140000, atsHyderabad: 140000, atsBangalore: 140000 },
  { name: 'Lipoma & Cyst 70+', category: 'Cosmetic', atsNewDelhi: 150000, atsMumbai: 150000, atsPune: 150000, atsHyderabad: 150000, atsBangalore: 150000 },
  { name: 'Piles, Fissure and Fistula', category: 'Proctology', atsNewDelhi: 40000, atsMumbai: 45000, atsPune: 45000, atsHyderabad: 45000, atsBangalore: 45000 },
  { name: 'Anal Abscess', category: 'Proctology', atsNewDelhi: 35000, atsMumbai: 35000, atsPune: 35000, atsHyderabad: 35000, atsBangalore: 35000 },
  { name: 'Scrotum Cyst', category: 'Urology Circumcision', atsNewDelhi: 35000, atsMumbai: 35000, atsPune: 35000, atsHyderabad: 35000, atsBangalore: 35000 },
  { name: 'Circumcision', category: 'Urology Circumcision', atsNewDelhi: 28000, atsMumbai: 30000, atsPune: 35000, atsHyderabad: 35000, atsBangalore: 35000 },
  { name: 'Frenuloplasty (Only In Clinic)', category: 'Urology Circumcision', atsNewDelhi: 20000, atsMumbai: 20000, atsPune: 20000, atsHyderabad: 20000, atsBangalore: 20000 },
  { name: 'Hydrocele', category: 'Urology Circumcision', atsNewDelhi: 35000, atsMumbai: 35000, atsPune: 35000, atsHyderabad: 35000, atsBangalore: 35000 },
  { name: 'Appendix', category: 'Laparoscopy', atsNewDelhi: 40000, atsMumbai: 45000, atsPune: 45000, atsHyderabad: 50000, atsBangalore: 50000 },
  { name: 'Umbilical Hernia', category: 'Laparoscopy', atsNewDelhi: 100000, atsMumbai: 120000, atsPune: 120000, atsHyderabad: 120000, atsBangalore: 120000 },
  { name: 'Inguinal Hernia-U/L', category: 'Laparoscopy', atsNewDelhi: 100000, atsMumbai: 120000, atsPune: 120000, atsHyderabad: 120000, atsBangalore: 120000 },
  { name: 'Inguinal Hernia-B/L', category: 'Laparoscopy', atsNewDelhi: 150000, atsMumbai: 150000, atsPune: 150000, atsHyderabad: 150000, atsBangalore: 150000 },
  { name: 'Gallbladder Removal (Lap)', category: 'Laparoscopy', atsNewDelhi: 50000, atsMumbai: 60000, atsPune: 60000, atsHyderabad: 60000, atsBangalore: 60000 },
  { name: 'RIRS Kidney Stone', category: 'Urology Kidney Stone', atsNewDelhi: 90000, atsMumbai: 100000, atsPune: 100000, atsHyderabad: 100000, atsBangalore: 100000 },
  { name: 'PCNL Kidney Stone', category: 'Urology Kidney Stone', atsNewDelhi: 80000, atsMumbai: 90000, atsPune: 90000, atsHyderabad: 90000, atsBangalore: 90000 },
  { name: 'URS Kidney Stone', category: 'Urology Kidney Stone', atsNewDelhi: 70000, atsMumbai: 70000, atsPune: 70000, atsHyderabad: 70000, atsBangalore: 70000 },
  { name: 'Stenting and Removal', category: 'Urology Kidney Stone', atsNewDelhi: 30000, atsMumbai: 30000, atsPune: 30000, atsHyderabad: 30000, atsBangalore: 30000 },
  { name: 'Sleeve Gastrectomy', category: 'Bariatric', atsNewDelhi: 320000, atsMumbai: 320000, atsPune: 320000, atsHyderabad: 320000, atsBangalore: 320000 },
  { name: 'Balloon Method', category: 'Bariatric', atsNewDelhi: 350000, atsMumbai: 350000, atsPune: 350000, atsHyderabad: 350000, atsBangalore: 350000 },
  { name: 'Varicocele', category: 'Vascular', atsNewDelhi: 70000, atsMumbai: 70000, atsPune: 70000, atsHyderabad: 70000, atsBangalore: 70000 },
  { name: 'Varicose Vein U/L-Laser', category: 'Vascular', atsNewDelhi: 70000, atsMumbai: 80000, atsPune: 80000, atsHyderabad: 80000, atsBangalore: 80000 },
  { name: 'Varicose Vein B/L-Laser', category: 'Vascular', atsNewDelhi: 120000, atsMumbai: 120000, atsPune: 120000, atsHyderabad: 120000, atsBangalore: 120000 },
  { name: 'Varicose Vein U/L-Sclero-Therapy', category: 'Vascular', atsNewDelhi: 40000, atsMumbai: 50000, atsPune: 50000, atsHyderabad: 50000, atsBangalore: 50000 },
  { name: 'Varicose Vein B/L-Sclero-Therapy', category: 'Vascular', atsNewDelhi: 50000, atsMumbai: 60000, atsPune: 60000, atsHyderabad: 60000, atsBangalore: 60000 },
  { name: 'Varicose Vein U/L-Venaseal', category: 'Vascular', atsNewDelhi: 320000, atsMumbai: 320000, atsPune: 320000, atsHyderabad: 320000, atsBangalore: 320000 },
  { name: 'Varicose Vein B/L-Venaseal', category: 'Vascular', atsNewDelhi: 450000, atsMumbai: 450000, atsPune: 450000, atsHyderabad: 450000, atsBangalore: 450000 },
  { name: 'ACL Reconstruction with Meniscus Repair U/L', category: 'Orthopedic', atsNewDelhi: 150000, atsMumbai: 150000, atsPune: 150000, atsHyderabad: 150000, atsBangalore: 150000 },
  { name: 'ACL Reconstruction with Meniscus Repair B/L', category: 'Orthopedic', atsNewDelhi: 225000, atsMumbai: 225000, atsPune: 225000, atsHyderabad: 225000, atsBangalore: 225000 },
  { name: 'Knee Replacement U/L', category: 'Orthopedic', atsNewDelhi: 350000, atsMumbai: 350000, atsPune: 350000, atsHyderabad: 350000, atsBangalore: 350000 },
  { name: 'Knee Replacement B/L', category: 'Orthopedic', atsNewDelhi: 500000, atsMumbai: 500000, atsPune: 500000, atsHyderabad: 500000, atsBangalore: 500000 },
  { name: 'LASIK', category: 'Ophthalmology', atsNewDelhi: 80000, atsMumbai: 85000, atsPune: 85000, atsHyderabad: 85000, atsBangalore: 85000 },
  { name: 'Cataract (Mono Focal)', category: 'Ophthalmology', atsNewDelhi: 35000, atsMumbai: 35000, atsPune: 35000, atsHyderabad: 35000, atsBangalore: 35000 },
]

async function main() {
  console.log('🌱 Starting treatment master seed...\n')

  for (const treatment of treatments) {
    await prisma.treatmentMaster.upsert({
      where: { name: treatment.name },
      update: {
        category: treatment.category,
        atsNewDelhi: treatment.atsNewDelhi,
        atsMumbai: treatment.atsMumbai,
        atsPune: treatment.atsPune,
        atsHyderabad: treatment.atsHyderabad,
        atsBangalore: treatment.atsBangalore,
      },
      create: treatment,
    })
    console.log(`✓ ${treatment.name}`)
  }

  console.log(`\n✅ Successfully seeded ${treatments.length} treatments`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
