import { prisma } from '@/lib/prisma'
import { fetchAttendanceLogs } from '@/lib/hrms/biometric-api-client'
import { normalizePunchDirection } from '@/lib/hrms/attendance-utils'
import { format } from 'date-fns'

export interface AttendanceSyncProgress {
  employeeId: string
  employeeName: string
  status: 'pending' | 'syncing' | 'done' | 'error'
  processed: number
  skipped: number
  errors: number
  total: number
  message?: string
}

/**
 * Sync attendance logs from biometric API for a specific employee.
 * fromDate defaults to 2026-01-01.
 */
export async function syncAttendanceForEmployee(
  employeeId: string,
  employeeName: string,
  employeeCode: string,
  fromDateStr = '2026-01-01',
  onProgress?: (progress: AttendanceSyncProgress) => void
): Promise<AttendanceSyncProgress> {
  const progress: AttendanceSyncProgress = {
    employeeId,
    employeeName,
    status: 'syncing',
    processed: 0,
    skipped: 0,
    errors: 0,
    total: 0,
  }
  onProgress?.(progress)

  try {
    const startDate = new Date(fromDateStr)
    const today = new Date()
    const fromDate = format(startDate, 'yyyy-MM-dd')
    const toDate = format(today, 'yyyy-MM-dd')

    const logs = await fetchAttendanceLogs(fromDate, toDate)
    const employeeLogs = logs.filter((log) => {
      const code = log.EmpCode?.trim() || ''
      return code === employeeCode || code.toLowerCase() === employeeCode.toLowerCase()
    })

    progress.total = employeeLogs.length
    onProgress?.(progress)

    for (const log of employeeLogs) {
      try {
        const logDate = new Date(log.IOTime)
        if (isNaN(logDate.getTime())) {
          progress.errors++
          continue
        }

        const punchDirection = normalizePunchDirection(log.IOMode)

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
          progress.skipped++
          continue
        }

        await prisma.attendanceLog.create({
          data: {
            employeeId,
            logDate,
            punchDirection,
            temperature: 0,
            serialNumber: log.DeviceKey || null,
          },
        })

        progress.processed++
      } catch {
        progress.errors++
      }

      if ((progress.processed + progress.skipped + progress.errors) % 50 === 0) {
        onProgress?.(progress)
      }
    }

    progress.status = 'done'
    progress.message = `Processed ${progress.processed}, skipped ${progress.skipped} duplicates`
    onProgress?.(progress)
    return progress
  } catch (error) {
    progress.status = 'error'
    progress.message = error instanceof Error ? error.message : 'Unknown error'
    onProgress?.(progress)
    return progress
  }
}
