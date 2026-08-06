import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { fetchAttendanceLogs } from '@/lib/hrms/biometric-api-client'
import { normalizePunchDirection } from '@/lib/hrms/attendance-utils'
import { headcountEmployeeWhere } from '@/lib/hrms/headcount'
import { PunchDirection } from '@/generated/prisma/client'
import { format, subDays } from 'date-fns'

/**
 * Daily sync endpoint
 * 
 * This endpoint syncs attendance data from yesterday to today (in IST).
 * Can be called by cron jobs or scheduled tasks.
 * 
 * To secure this endpoint, you can:
 * 1. Add authentication via API key in headers
 * 2. Use Vercel Cron Jobs with secret verification
 * 3. Use environment variable check
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify API key or secret for security
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.CRON_SECRET
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return errorResponse('Unauthorized', 401)
    }

    // Get current time in IST (UTC+5:30)
    // IST is 5 hours and 30 minutes ahead of UTC
    const now = new Date()
    const istOffsetMs = 5.5 * 60 * 60 * 1000 // 5.5 hours in milliseconds
    const istNow = new Date(now.getTime() + istOffsetMs)
    
    // Get IST date components (using UTC getters since we've already offset the time)
    const istYear = istNow.getUTCFullYear()
    const istMonth = istNow.getUTCMonth() // 0-11
    const istDay = istNow.getUTCDate()
    
    // Get today's date in IST
    const todayIST = new Date(Date.UTC(istYear, istMonth, istDay))
    
    // Get yesterday's date in IST (today - 1 day)
    const yesterdayIST = new Date(Date.UTC(istYear, istMonth, istDay - 1))
    
    // Format as yyyy-MM-dd manually to avoid timezone issues
    const yesterdayYear = yesterdayIST.getUTCFullYear()
    const yesterdayMonth = String(yesterdayIST.getUTCMonth() + 1).padStart(2, '0')
    const yesterdayDay = String(yesterdayIST.getUTCDate()).padStart(2, '0')
    const fromDate = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`
    
    const todayYear = todayIST.getUTCFullYear()
    const todayMonth = String(todayIST.getUTCMonth() + 1).padStart(2, '0')
    const todayDay = String(todayIST.getUTCDate()).padStart(2, '0')
    const toDate = `${todayYear}-${todayMonth}-${todayDay}`

    console.log(`🔄 Daily sync: Fetching attendance from ${fromDate} to ${toDate}`)

    // Active roster only — skip terminated/absconded biometric codes
    const employees = await prisma.employee.findMany({
      where: headcountEmployeeWhere,
      select: {
        id: true,
        employeeCode: true,
      },
    })

    const employeeCodeMap = new Map<string, string>()
    for (const e of employees) {
      const code = e.employeeCode
      if (!code) continue
      employeeCodeMap.set(code, e.id)
      const trimmed = code.trim()
      if (trimmed !== code) employeeCodeMap.set(trimmed, e.id)
      const lower = code.toLowerCase()
      if (lower !== code) employeeCodeMap.set(lower, e.id)
      // Numeric normalization: "01330" -> "1330" for matching
      const num = String(Number(code))
      if (num !== 'NaN' && num !== code) employeeCodeMap.set(num, e.id)
    }

    // Fetch attendance logs from API
    const logs = await fetchAttendanceLogs(fromDate, toDate)

    let processed = 0
    let skipped = 0
    let errors = 0
    const skipReasons: Record<string, number> = {
      invalidEmpCode: 0,
      employeeNotFound: 0,
      duplicate: 0,
    }
    const missingEmployeeCodes = new Set<string>()

    // Process each log
    for (const log of logs) {
      try {
        // Skip invalid employee codes
        const rawEmpCode = log.EmpCode?.trim() ?? ''
        if (!rawEmpCode || rawEmpCode === '0') {
          skipped++
          skipReasons.invalidEmpCode++
          continue
        }

        // Try multiple lookup strategies (exact, case-insensitive, numeric)
        const employeeId =
          employeeCodeMap.get(rawEmpCode) ??
          employeeCodeMap.get(rawEmpCode.toLowerCase()) ??
          (rawEmpCode && !isNaN(Number(rawEmpCode)) ? employeeCodeMap.get(String(Number(rawEmpCode))) : undefined)
        if (!employeeId) {
          skipped++
          skipReasons.employeeNotFound++
          missingEmployeeCodes.add(rawEmpCode)
          continue
        }

        // Parse IOTime string.
        // IMPORTANT: `IOTime` already represents the correct IST wall-clock time coming from the device.
        // DO NOT do any timezone conversions. We store the timestamp exactly as provided.
        const iotimeMatch = log.IOTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
        if (!iotimeMatch) {
          console.error(`Invalid IOTime format: ${log.IOTime}`)
          errors++
          continue
        }
        
        const [, year, month, day, hour, minute, second] = iotimeMatch.map(Number)

        // Store as-is (no conversion).
        // We intentionally create a UTC timestamp with the same clock components so rendering
        // can also use UTC and show the same HH:mm the API provided.
        const logDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
        
        if (isNaN(logDate.getTime())) {
          console.error(`Invalid date created from IOTime: ${log.IOTime}`)
          errors++
          continue
        }

        // Normalize punch direction from IOMode
        let punchDirection = normalizePunchDirection(log.IOMode)

        // Fix: If this is an IN entry, check if there's already an IN log for this employee on this day
        // If yes, treat this second IN entry as OUT (biometric device sometimes marks exits as "in")
        if (punchDirection === PunchDirection.IN) {
          const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
          const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
          
          const existingInLog = await prisma.attendanceLog.findFirst({
            where: {
              employeeId,
              logDate: {
                gte: dayStart,
                lte: dayEnd,
              },
              punchDirection: PunchDirection.IN,
            },
          })
          
          if (existingInLog) {
            // This is a second IN entry, treat it as OUT
            punchDirection = PunchDirection.OUT
          }
        }

        // Check for duplicate (using the corrected punch direction)
        const existing = await prisma.attendanceLog.findUnique({
          where: {
            employeeId_logDate_punchDirection: {
              employeeId,
              logDate,
              punchDirection,
            },
          },
        })

        if (existing) {
          skipped++
          skipReasons.duplicate++
          continue
        }

        // Create attendance log
        await prisma.attendanceLog.create({
          data: {
            employeeId,
            logDate,
            punchDirection,
            temperature: 0, // Not available in new API
            serialNumber: log.DeviceKey || null,
          },
        })

        processed++
      } catch (error) {
        console.error('Error processing attendance log:', error)
        errors++
      }
    }

    return successResponse({
      fromDate,
      toDate,
      processed,
      skipped,
      errors,
      total: logs.length,
      skipReasons,
      missingEmployeeCodes: Array.from(missingEmployeeCodes),
      apiResponse: {
        logsReceived: logs.length,
        sampleLogs: logs.length > 0 ? {
          first: logs[0],
          last: logs.length > 1 ? logs[logs.length - 1] : null,
        } : null,
      },
    })
  } catch (error) {
    console.error('Error in daily sync:', error)
    return errorResponse('Failed to sync attendance', 500)
  }
}

// Also support GET for easier cron job setup
export async function GET(request: NextRequest) {
  return POST(request)
}

