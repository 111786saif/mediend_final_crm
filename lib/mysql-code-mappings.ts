/**
 * MySQL Code Mappings
 * Maps numeric codes from MySQL database to their text values
 * Based on lead_codes.txt
 */

/**
 * Status code mappings (from MySQL status table)
 * Maps status ID to status text
 */
const STATUS_MAP: Record<string, string> = {
  '1': 'Follow-up 1',
  '2': 'Follow-up 2',
  '3': 'Follow-up 3',
  '4': 'DNP-1',
  '5': 'DNP-2',
  '6': 'DNP-3',
  '7': 'DNP-4',
  '8': 'DNP-5',
  '9': 'DNP Exhausted',
  '10': 'Fund Issues',
  '11': 'OPD Done',
  '12': 'OPD Schedule',
  '13': 'IPD Done',
  '14': 'IPD Schedule',
  '15': 'IPD Lost',
  '16': 'Out of Station',
  '17': 'Supply Gap',
  '18': 'Language Barrier',
  '19': 'Call Back (SD)',
  '20': 'Call Back (T)',
  '21': 'Call Back Next Week',
  '22': 'Call Back Next Month',
  '23': 'SX Not Suggested',
  '24': 'Order Booked',
  '25': 'Closed',
  '26': 'Junk',
  '27': 'New Lead',
  '28': 'Hot Lead',
  '29': 'Scan Done',
  '30': 'Call Done',
  '31': 'WA Done',
  '32': 'C/W Done',
  '33': 'Not Interested',
  '34': 'Duplicate lead',
  '35': 'Follow-up',
  '36': 'Invalid Number',
  '37': 'Nurture',
  '38': 'Policy Booked',
  '39': 'Interested',
  '40': 'Policy Issued',
  '41': 'Already Insured',
  '42': 'Out of station follow-up',
}

/**
 * Source code mappings (from MySQL source table)
 * Maps source ID to source text
 */
const SOURCE_MAP: Record<string, string> = {
  '1': 'Facebook',
  '2': 'Google',
  '3': 'Mixone',
  '4': 'Meta Marketplace',
  '5': 'LinkedIn',
  '6': 'Referral',
  '7': 'Competitor-C1',
  '8': 'Competitor-C',
  '9': 'ProData',
  '10': 'In bound call',
  '11': 'Instagram',
  '12': 'Organic-Lead',
  '13': 'Competitor-Ads-1',
  '14': 'Competitor-Ads-2',
  '15': 'Pro-Data-2',
  '16': 'Insurance',
  '17': 'Google Ads',
  '18': 'GP-AK-321',
  '19': 'SP182',
  '20': 'KVS290',
  '21': 'Offline',
  '22': 'Test',
  '23': 'Pt. Referral',
}

/**
 * Circle code mappings (from MySQL Circle table)
 * Maps circle ID to circle name
 */
const CIRCLE_MAP: Record<string, string> = {
  '1': 'Default',
  '2': 'Mumbai',
  '3': 'Pune',
  '4': 'Delhi',
  '5': 'Noida',
  '6': 'Gurugram',
  '7': 'Bangalore',
  '8': 'Faridabad',
  '9': 'Ghaziabad',
  '10': 'Nagpur',
  '11': 'Others',
  '12': 'Hyderabad',
  '13': 'Lucknow',
  '14': 'Kolkata',
  '15': 'Chandigarh',
  '16': 'Jaipur',
  '17': 'Agra',
  '18': 'Ranchi',
  '19': 'Patna',
  '20': 'Chennai',
  '21': 'Thane',
  '22': 'Indore',
  '23': 'Nasik',
}

/**
 * Category code mappings (from MySQL category table)
 * Maps category ID to category name
 */
const CATEGORY_MAP: Record<string, string> = {
  '1': 'Aesthetics',
  '2': 'Proctology',
  '3': 'Laparoscopy',
  '4': 'Gynaecology',
  '5': 'ENT',
  '6': 'Urology',
  '7': 'Vascular',
  '8': 'Orthopaedics',
  '9': 'Ophthalmology',
  '10': 'Weight Loss',
  '11': 'NA',
  '12': 'Hair Loss',
  '13': '-',
}

/**
 * Legacy: campaign IDs that were wrongly stored in lead.Source (CRM source_campaign.id).
 * Resolve to a display label. Add more as discovered.
 */
const SOURCE_AS_CAMPAIGN_LEGACY: Record<string, string> = {
  '58': 'Dr. Sahil (campaign)',
}

/**
 * Status IDs that were wrongly stored in lead.Source (status misuse). Treat as Unknown.
 */
const SOURCE_AS_STATUS_LEGACY_IDS = new Set(['25', '27', '28']) // Closed, New Lead, Hot Lead

/**
 * Resolve lead.Source to a display label (lookup-based, no guessing).
 * Order: source table (1–23) → campaign legacy (e.g. 58) → status legacy (25,27,28) → Unknown.
 * Do NOT treat unknown numerics as treatment IDs — data shows source is ~98% clean.
 */
export function resolveSourceForDisplay(value: string | null | undefined): string {
  if (value == null || String(value).trim() === '') return 'Unknown'
  const trimmed = String(value).trim()
  if (SOURCE_MAP[trimmed]) return SOURCE_MAP[trimmed]
  if (SOURCE_AS_CAMPAIGN_LEGACY[trimmed]) return SOURCE_AS_CAMPAIGN_LEGACY[trimmed]
  if (SOURCE_AS_STATUS_LEGACY_IDS.has(trimmed)) return 'Unknown'
  if (/^\d+$/.test(trimmed)) return 'Unknown' // other numeric = unknown, not treatment
  return trimmed
}

/**
 * Normalize lead.source for DB: only set when we can classify (source / campaign legacy / status legacy).
 * Returns value to store, or null to leave unchanged.
 */
export function normalizeSourceForDb(value: string | null | undefined): string | null {
  if (value == null || String(value).trim() === '') return 'Unknown'
  const trimmed = String(value).trim()
  if (SOURCE_MAP[trimmed]) return SOURCE_MAP[trimmed]
  if (SOURCE_AS_CAMPAIGN_LEGACY[trimmed]) return SOURCE_AS_CAMPAIGN_LEGACY[trimmed]
  if (SOURCE_AS_STATUS_LEGACY_IDS.has(trimmed)) return 'Unknown'
  if (/^\d+$/.test(trimmed)) return 'Unknown'
  return trimmed
}

/**
 * Treatment code mappings (from MySQL treatment table)
 * Maps treatment ID to treatment name
 */
const TREATMENT_MAP: Record<string, string> = {
  '1': 'Gynecomastia',
  '2': 'Varicose Veins',
  '3': 'Lipoma',
  '4': 'Tummy Tuck',
  '5': 'Breast Lump',
  '6': 'Buccal Fat',
  '7': 'Breast Lift',
  '8': 'Breast Reduction',
  '9': 'Rhinoplasty',
  '10': 'Piles',
  '11': 'Fistula',
  '12': 'Fissure',
  '13': 'Pilonidal Sinus',
  '14': 'Hernia',
  '15': 'Gallstone',
  '16': 'Appendicitis',
  '17': 'Inguinal Hernia',
  '18': 'Umbilical Hernia',
  '19': 'MTP',
  '20': 'Uterus Removal',
  '21': 'Tympanoplasty',
  '22': 'Adenoidectomy',
  '23': 'Sinus',
  '24': 'Mastoidectomy',
  '25': 'Throat Surgery',
  '26': 'Ear Surgery',
  '27': 'Vocal Cord Polyps',
  '28': 'Nasal Polyps',
  '29': 'Turbinate Reduction',
  '30': 'Circumcision',
  '31': 'Stapler Circumcision',
  '32': 'Kidney Stones',
  '33': 'Hydrocele',
  '34': 'ESWL',
  '35': 'RIRS',
  '36': 'PCNL',
  '37': 'URSL',
  '38': 'Enlarged Prostate',
  '39': 'Varicocele',
  '40': 'DVT Treatment',
  '41': 'Diabetic Foot Ulcer',
  '42': 'Uterine Fibroids',
  '43': 'Breast Lift Surgery',
  '44': 'Sebaceous Cyst',
  '45': 'Breast Augmentation',
  '46': 'Axillary Breast',
  '47': 'Double Chin',
  '48': 'Earlobe Repair',
  '49': 'Blepharoplasty',
  '50': 'Beard Transplant',
  '51': 'Cleft Lip',
  '52': 'Knee Replacement',
  '53': 'Carpal Tunnel Syndrome',
  '54': 'ACL Tear',
  '55': 'ProcMeniscus Tear Treatmenttology',
  '56': 'Hip Replacement Surgery',
  '57': 'Spine Surgery',
  '58': 'Shoulder Dislocation',
  '59': 'Shoulder Replacement',
  '60': 'Lasik Eye',
  '61': 'Cataract',
  '62': 'Retinal Detachment',
  '63': 'Glaucoma Treatment',
  '64': 'Squint',
  '65': 'Diabetic Retinopathy',
  '66': 'Vitrectomy',
  '67': 'PRK Lasik',
  '68': 'SMILE Lasik',
  '69': 'FEMTO Lasik',
  '70': 'ICL',
  '71': 'Contoura Vision',
  '72': 'Phaco Surgery',
  '73': 'Bariatric',
  '74': 'SPATZ intragastric balloon',
  '75': 'Weightloss',
  '76': 'Liposuction',
  '77': 'Balanoposthitis',
  '78': 'Balanitis',
  '79': 'Cyst on Scrotum',
  '80': 'Penile Cyst',
  '81': 'Phimosis',
  '82': 'Excess Body Fat',
  '83': 'Nasal Deformity',
  '84': 'Obesity',
  '85': 'Stent removal',
  '86': 'Gallstones',
  '87': 'NA',
  '88': 'Hair Loss',
  '89': 'Foreskin problm',
  '90': 'Tight Foreskin',
  '91': 'Ganglion Cyst',
  '92': 'Ankle Arthroscopy',
  '93': 'Joint Replacement',
  '94': 'Urine Infection',
  '95': 'Chest wall lump',
  '96': 'Abdominal Wall Repair',
  '97': 'Cystostomy',
  '98': 'Deviated Nasal Septum (Septoplasty)',
  '99': 'Medical Management',
  '100': 'Nasal sinus',
  '101': 'Hysterectomy',
  '102': 'Penis infection',
  '103': 'Cystoscopy',
}

/**
 * Maps a status code to its text value
 * @param code - Status code (string number like "25") or text value
 * @returns Status text value, or original value if not found/not a code
 */
export function mapStatusCode(code: string | null | undefined): string {
  if (!code) return 'New'
  
  const trimmed = String(code).trim()
  const normalized = trimmed.toLowerCase()
  
  // If it's a numeric code, try to map it
  if (/^\d+$/.test(trimmed)) {
    return STATUS_MAP[trimmed] || trimmed
  }

  if (normalized === 'opd_scheduled' || normalized === 'opd scheduled') {
    return 'OPD Schedule'
  }
  
  // Otherwise, return the original value (might already be text)
  return trimmed
}

/**
 * Maps a source code to its text value
 * @param code - Source code (string number like "13") or text value
 * @returns Source text value, or original value if not found/not a code
 */
export function mapSourceCode(code: string | null | undefined): string | null {
  if (!code) return null
  
  const trimmed = String(code).trim()
  
  // If it's a numeric code, try to map it
  if (/^\d+$/.test(trimmed)) {
    return SOURCE_MAP[trimmed] || trimmed
  }
  
  // Otherwise, return the original value (might already be text)
  return trimmed
}

/**
 * Checks if a value is a numeric code that needs mapping
 * @param value - Value to check
 * @returns True if value is a numeric code
 */
export function isStatusCode(value: string | null | undefined): boolean {
  if (!value) return false
  return /^\d+$/.test(String(value).trim())
}

/**
 * Checks if a value is a numeric source code that needs mapping
 * @param value - Value to check
 * @returns True if value is a numeric code
 */
export function isSourceCode(value: string | null | undefined): boolean {
  if (!value) return false
  return /^\d+$/.test(String(value).trim())
}

/**
 * Maps a treatment code to its text value
 * @param code - Treatment code (string number like "3") or text value
 * @returns Treatment text value, or original value if not found/not a code
 */
export function mapTreatmentCode(code: string | number | null | undefined): string | null {
  if (code === null || code === undefined) return null
  const trimmed = String(code).trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) {
    return TREATMENT_MAP[trimmed] ?? trimmed
  }
  return trimmed
}

/**
 * Checks if a value is a numeric treatment code that needs mapping
 */
export function isTreatmentCode(value: string | null | undefined): boolean {
  if (!value) return false
  return /^\d+$/.test(String(value).trim())
}

/**
 * Maps a circle code to its text value
 * @param code - Circle code (string number like "2") or text value
 * @returns Circle text value, or original value if not found/not a code
 */
export function mapCircleCode(code: string | number | null | undefined): string | null {
  if (code === null || code === undefined) return null
  const trimmed = String(code).trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) {
    return CIRCLE_MAP[trimmed] ?? trimmed
  }
  return trimmed
}

/**
 * Maps a category code to its text value
 * @param code - Category code (string number like "1") or text value
 * @returns Category text value, or original value if not found/not a code
 */
export function mapCategoryCode(code: string | number | null | undefined): string | null {
  if (code === null || code === undefined) return null
  const trimmed = String(code).trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) {
    return CATEGORY_MAP[trimmed] ?? trimmed
  }
  return trimmed
}
