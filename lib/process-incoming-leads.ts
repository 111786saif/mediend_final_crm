import { prisma } from '@/lib/prisma'
import { UserRole, PipelineStage } from '@/generated/prisma/client'
import { hashPassword } from '@/lib/auth'
import {
  DUPLICATE_LEAD_STATUS,
  normalizeLeadPhoneToLast10,
  recordDuplicateLeadHitByPrimaryPhone,
} from '@/lib/lead-duplicates'
import { createLeadAssignedNotification } from '@/lib/lead-notifications'

interface IncomingLeadPayload {
  id?: string
  '0'?: string // id
  Patient_Name?: string
  '3'?: string // Patient_Name
  Patient_Number?: string
  phone?: string
  phoneNumber?: string
  mobile?: string
  mobileNumber?: string
  Category?: string
  '4'?: string // Category
  Treatment?: string
  '5'?: string // Treatment
  BDM?: string
  '6'?: string // BDM
  TL?: string
  '7'?: string // TL
  Status?: string
  '9'?: string // Status
  Lead_Date?: string
  '2'?: string // Lead_Date
  LastRemarks?: string | null
  '8'?: string | null // LastRemarks
  month?: string
  '1'?: string // month
}

/**
 * Finds a BD user by name using multiple matching strategies
 */
async function findBDByName(name: string): Promise<{ id: string } | null> {
  if (!name) return null

  const trimmedName = name.trim()

  let user = await prisma.user.findFirst({
    where: {
      role: UserRole.BD,
      name: { equals: trimmedName, mode: 'insensitive' },
    },
    select: { id: true },
  })
  if (user) return { id: user.id }

  user = await prisma.user.findFirst({
    where: {
      role: UserRole.BD,
      name: { contains: trimmedName, mode: 'insensitive' },
    },
    select: { id: true },
  })
  if (user) return { id: user.id }

  const firstName = trimmedName.split(' ')[0]
  if (firstName && firstName.length > 2) {
    user = await prisma.user.findFirst({
      where: {
        role: UserRole.BD,
        name: { startsWith: firstName, mode: 'insensitive' },
      },
      select: { id: true },
    })
    if (user) return { id: user.id }
  }

  return null
}

/**
 * Creates a new BD user with default settings
 */
async function createBDUser(name: string): Promise<{ id: string }> {
  const emailBase = name.toLowerCase().replace(/\s+/g, '.')
  let email = `${emailBase}@mediend.local`
  let counter = 1

  while (await prisma.user.findUnique({ where: { email } })) {
    email = `${emailBase}${counter}@mediend.local`
    counter++
  }

  const defaultPassword = await hashPassword('Temp@123')
  const newUser = await prisma.user.create({
    data: {
      email,
      passwordHash: defaultPassword,
      name: name.trim(),
      role: UserRole.BD,
    },
    select: { id: true },
  })

  return { id: newUser.id }
}

/**
 * Gets a default system user for createdById/updatedById
 * Falls back to first ADMIN user, or first user found
 */
async function getDefaultSystemUser(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
  })
  if (admin) return admin.id

  const anyUser = await prisma.user.findFirst()
  if (anyUser) return anyUser.id

  throw new Error('No users found in system. Cannot process leads.')
}

/**
 * Extracts value from payload using both named and numeric keys
 * Always returns a string (converts numbers to strings) or null
 */
function getPayloadValue(
  payload: IncomingLeadPayload,
  namedKey: keyof IncomingLeadPayload,
  numericKey: keyof IncomingLeadPayload
): string | null {
  const value = payload[namedKey] ?? payload[numericKey]
  if (value === null || value === undefined) return null
  // Convert to string if it's a number
  return String(value)
}

function getPayloadPhone(payload: IncomingLeadPayload) {
  const value =
    payload.Patient_Number ??
    payload.phone ??
    payload.phoneNumber ??
    payload.mobile ??
    payload.mobileNumber ??
    null

  if (value === null || value === undefined) return null
  return String(value).trim()
}

/**
 * Processes a single incoming lead payload and creates a Lead record
 * @param autoCreateBD - If true, automatically create missing BD users
 */
export async function processIncomingLead(
  incomingLeadId: string,
  payload: IncomingLeadPayload | IncomingLeadPayload[],
  autoCreateBD: boolean = false
): Promise<{ success: boolean; leadId?: string; error?: string }> {
  try {
    // Handle array payload (take first item)
    const leadData = Array.isArray(payload) ? payload[0] : payload
    if (!leadData) {
      return { success: false, error: 'Empty payload' }
    }

    // Extract fields from payload (support both named and numeric keys)
    // Ensure leadId is always a string
    const leadId = String(getPayloadValue(leadData, 'id', '0') || `LEAD-${Date.now()}`)
    const patientName = getPayloadValue(leadData, 'Patient_Name', '3')
    const category = getPayloadValue(leadData, 'Category', '4')
    const treatment = getPayloadValue(leadData, 'Treatment', '5')
    const bdmName = getPayloadValue(leadData, 'BDM', '6')
    const status = getPayloadValue(leadData, 'Status', '9') || 'New Lead'
    const leadDateStr = getPayloadValue(leadData, 'Lead_Date', '2')
    const remarks = getPayloadValue(leadData, 'LastRemarks', '8') || null
    const phoneNumber = getPayloadPhone(leadData)

    // Validate required fields
    if (!patientName) {
      return { success: false, error: 'Missing patient name' }
    }

    if (!treatment) {
      return { success: false, error: 'Missing treatment' }
    }

    if (!phoneNumber) {
      return { success: false, error: 'Missing phone number' }
    }

    const normalizedPhone = normalizeLeadPhoneToLast10(phoneNumber)
    if (!normalizedPhone) {
      return { success: false, error: 'Phone number must contain at least 10 digits' }
    }

    // Find BD user by name
    let bdId: string | null = null
    const bdCircle = ''
    if (bdmName) {
      let bdInfo = await findBDByName(bdmName)
      
      // If not found and auto-create is enabled, create the BD user
      if (!bdInfo && autoCreateBD) {
        try {
          bdInfo = await createBDUser(bdmName)
          console.log(`Created new BD user: ${bdmName} (${bdInfo.id})`)
        } catch (createError) {
          return {
            success: false,
            error: `Failed to create BD user ${bdmName}: ${createError instanceof Error ? createError.message : 'Unknown error'}`,
          }
        }
      }
      
      if (!bdInfo) {
        return {
          success: false,
          error: `BD user not found: ${bdmName}. ${autoCreateBD ? 'Auto-creation failed.' : 'Please ensure the user exists with role BD, or enable auto-create.'}`,
        }
      }
      bdId = bdInfo.id
    } else {
      return { success: false, error: 'Missing BDM name' }
    }

    // Get default system user for createdBy/updatedBy
    const systemUserId = await getDefaultSystemUser()

    // Parse lead date
    let createdDate = new Date()
    if (leadDateStr) {
      const parsedDate = new Date(leadDateStr)
      if (!isNaN(parsedDate.getTime())) {
        createdDate = parsedDate
      }
    }

    // Check if lead with this leadRef already exists
    const existingLead = await prisma.lead.findUnique({
      where: { leadRef: leadId },
    })

    if (existingLead) {
      // Update status to PROCESSED but don't create duplicate
      await prisma.incomingLead.update({
        where: { id: incomingLeadId },
        data: { status: 'PROCESSED' },
      })
      return {
        success: true,
        leadId: existingLead.id,
        error: 'Lead already exists, marked as processed',
      }
    }

    const duplicateLead = await recordDuplicateLeadHitByPrimaryPhone(normalizedPhone, treatment)

    // Create the lead with required defaults for missing fields
    const lead = await prisma.lead.create({
      data: {
        leadRef: leadId,
        patientName,
        age: 0, // Default age (should be updated later)
        sex: 'Not Specified', // Default sex
        phoneNumber,
        bdId,
        status: duplicateLead ? DUPLICATE_LEAD_STATUS : status,
        pipelineStage: PipelineStage.SALES,
        circle: bdCircle || 'Unknown',
        category: category || null,
        treatment,
        hospitalName: 'Not Specified', // Default hospital (should be updated later)
        remarks: remarks || null,
        source: 'external_api',
        duplCount: 0,
        createdById: systemUserId,
        updatedById: systemUserId,
        createdDate,
      },
    })

    if (bdId) {
      await createLeadAssignedNotification({
        userId: bdId,
        patientName,
        leadRef: lead.leadRef,
        leadId: lead.id,
      })
    }

    // Update incoming lead status to PROCESSED
    await prisma.incomingLead.update({
      where: { id: incomingLeadId },
      data: {
        status: duplicateLead ? 'DUPLICATE' : 'PROCESSED',
        processedLeadId: lead.id,
        normalizedPhone,
        processedAt: new Date(),
        errorMessage: duplicateLead
          ? `Duplicate phone number. Existing lead: ${duplicateLead.leadRef}. Duplicate count: ${duplicateLead.duplCount}`
          : null,
      },
    })

    return {
      success: true,
      leadId: lead.id,
      ...(duplicateLead
        ? { error: `Duplicate phone number. Existing lead: ${duplicateLead.leadRef}` }
        : {}),
    }
  } catch (error) {
    console.error('Error processing incoming lead:', error)
    
    // Mark as FAILED
    try {
      await prisma.incomingLead.update({
        where: { id: incomingLeadId },
        data: { status: 'FAILED' },
      })
    } catch (updateError) {
      console.error('Error updating incoming lead status:', updateError)
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Processes all PENDING incoming leads
 * @param autoCreateBD - If true, automatically create missing BD users
 */
export async function processAllPendingLeads(
  autoCreateBD: boolean = false
): Promise<{
  processed: number
  failed: number
  results: Array<{ id: string; success: boolean; error?: string }>
}> {
  const pendingLeads = await prisma.incomingLead.findMany({
    where: { status: 'PENDING' },
    orderBy: { receivedAt: 'asc' },
  })

  const results: Array<{ id: string; success: boolean; error?: string }> = []
  let processed = 0
  let failed = 0

  for (const incomingLead of pendingLeads) {
    const result = await processIncomingLead(
      incomingLead.id,
      incomingLead.payload as IncomingLeadPayload | IncomingLeadPayload[],
      autoCreateBD
    )

    results.push({
      id: incomingLead.id,
      success: result.success,
      error: result.error,
    })

    if (result.success) {
      processed++
    } else {
      failed++
    }
  }

  return { processed, failed, results }
}
