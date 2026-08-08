import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { fetchAttendanceLogs } from '@/lib/hrms/biometric-api-client'
import { normalizePunchDirection } from '@/lib/hrms/attendance-utils'
import { headcountEmployeeWhere } from '@/lib/hrms/headcount'
import { PunchDirection } from '@/generated/prisma/client'
import { z } from 'zod'

const syncSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'hrms:attendance:write')) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const { fromDate, toDate } = syncSchema.parse(body)

    // Fetch attendance logs from biometric API
    const logs = await fetchAttendanceLogs(fromDate, toDate)

    // Active roster only — do not sync punches for terminated/absconded
    const employees = await prisma.employee.findMany({
      where: headcountEmployeeWhere,
      select: {
        id: true,
        employeeCode: true,
      },
    })

    const employeeCodeMap = new Map(employees.map((e) => [e.employeeCode, e.id]))

    let processed = 0
    let skipped = 0
    let errors = 0

    // Process each log
    for (const log of logs) {
      try {
        // Skip invalid employee codes
        if (!log.EmpCode || log.EmpCode === '0' || log.EmpCode.trim() === '') {
          skipped++
          continue
        }

        const employeeId = employeeCodeMap.get(log.EmpCode)
        if (!employeeId) {
          skipped++
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
      processed,
      skipped,
      errors,
      total: logs.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error syncing attendance:', error)
    return errorResponse('Failed to sync attendance', 500)
  }
}

