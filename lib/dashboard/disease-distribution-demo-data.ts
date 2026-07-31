import type { DistributionInput } from './prepare-distribution'

/**
 * Sample dataset (~24 raw rows) mirroring messy production category values.
 * Use only for local verification of prepareDistribution / DiseaseDistribution.
 */
export const DEMO_DISEASE_DISTRIBUTION: DistributionInput[] = [
  { category: 'Orthopaedics', count: 1842 },
  { category: 'Orthopedic', count: 96 },
  { category: 'Urology', count: 571 },
  { category: 'Urology Kidney Stone', count: 88 },
  { category: 'Ophthalmology', count: 241 },
  { category: 'ophthalmology', count: 14 },
  { category: 'Aesthetics', count: 198 },
  { category: 'Cosmetic', count: 42 },
  { category: 'Proctology', count: 112 },
  { category: 'Laparoscopy', count: 89 },
  { category: 'laparoscopy', count: 11 },
  { category: 'Vascular', count: 76 },
  { category: 'Bariatric', count: 54 },
  { category: 'ENT', count: 47 },
  { category: 'Gynaecology', count: 39 },
  { category: 'General Medicine', count: 33 },
  { category: 'Medical Managment', count: 28 },
  { category: 'Medical Management', count: 19 },
  { category: 'Weight Loss', count: 24 },
  { category: 'Hair Loss', count: 18 },
  { category: '1', count: 12 },
  { category: '6', count: 9 },
  { category: '-', count: 7 },
  { category: 'Uncategorized', count: 5 },
  { category: 'Orthology', count: 22 },
  { category: 'Urology Circumcision', count: 31 },
]
