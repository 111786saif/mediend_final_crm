import { prisma } from '@/lib/prisma'
import { UserRole, EmployeeStatus } from '@/generated/prisma/client'
import { queryMySQL } from '@/lib/mysql-source-client'
import { hashPassword } from '@/lib/auth'

interface MySQLStaffRow {
  staffid: number
  email: string
  firstname: string
  lastname: string
  Designation?: string | null
  level: number
  team_leader: number
  active: number
  grade?: number | null
  joining_date?: Date | string | null
  phonenumber?: string | null
}

interface StaffSyncResult {
  usersCreated: number
  usersUpdated: number
  employeesCreated: number
  employeesUpdated: number
  teamsCreated: number
  teamsUpdated: number
}

/**
 * Syncs tblstaff from MySQL CRM to Prisma User + Employee + Team
 * Uses staffid as bdNumber for reliable BD resolution during lead sync.
 */
export async function syncStaffFromMySQL(): Promise<StaffSyncResult> {
  console.log('🔄 Starting staff sync from MySQL CRM...')

  const result: StaffSyncResult = {
    usersCreated: 0,
    usersUpdated: 0,
    employeesCreated: 0,
    employeesUpdated: 0,
    teamsCreated: 0,
    teamsUpdated: 0,
  }

  try {
    // Test MySQL connection
    const isConnected = await queryMySQL('SELECT 1 as test').catch(() => null)
    if (!isConnected) {
      console.warn('⚠️ MySQL connection failed, skipping staff sync')
      return result
    }

    console.log('📋 Fetching active staff from tblstaff...')
    
    let staffRows: MySQLStaffRow[] = []
    try {
      staffRows = await queryMySQL<MySQLStaffRow>(`
        SELECT 
          staffid, email, firstname, lastname, Designation, 
          level, team_leader, active, grade, joining_date, phonenumber 
        FROM tblstaff 
        WHERE active = 1 AND is_not_staff = 0
        ORDER BY level DESC, staffid ASC
      `)
      console.log(`✅ Found ${staffRows.length} active staff members`)
    } catch (staffError: any) {
      console.warn(`⚠️ Could not read tblstaff table: ${staffError.message}`)
      console.warn('This is expected if the MySQL user has limited permissions.')
      console.warn('Staff sync will be skipped. BD resolution will still work via name matching.')
      return result
    }

    // Get existing teams for reference
    const existingTeams = await prisma.team.findMany({
      select: { id: true, name: true, teamLeadId: true, salesHeadId: true }
    })
    const teamMap = new Map(existingTeams.map(t => [t.id, t]))

    // Process each staff member
    for (const staff of staffRows) {
      const fullName = `${staff.firstname.trim()} ${staff.lastname.trim()}`.trim()
      const email = staff.email?.trim() || `${staff.firstname.toLowerCase()}.${staff.lastname.toLowerCase()}@mediend.local`
      
      // Determine role based on level and hierarchy
      let role: UserRole = UserRole.BD
      if (staff.level >= 2) role = UserRole.SALES_HEAD
      else if (staff.level === 1 || staff.team_leader > 0) role = UserRole.TEAM_LEAD

      // 1. Find or create User
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: email, mode: 'insensitive' } },
            // Also match by bdNumber via Employee
            { employee: { bdNumber: staff.staffid } }
          ]
        }
      })

      const defaultPassword = await hashPassword('Temp@123')

      if (!user) {
        // Create new user
        user = await prisma.user.create({
          data: {
            email,
            passwordHash: defaultPassword,
            name: fullName,
            role,
            phoneNumber: staff.phonenumber || null,
          }
        })
        result.usersCreated++
        console.log(`✅ Created user: ${fullName} (${role})`)
      } else {
        // Update existing user if role changed or name changed
        const needsUpdate = user.role !== role || user.name !== fullName
        if (needsUpdate) {
          await prisma.user.update({
            where: { id: user.id },
            data: { 
              role,
              name: fullName,
              ...(user.email.includes('@mediend.local') ? { email } : {})
            }
          })
          result.usersUpdated++
          console.log(`🔄 Updated user: ${fullName} (role: ${role})`)
        }
      }

      // 2. Find or create Employee record with bdNumber
      let employee = await prisma.employee.findFirst({
        where: { bdNumber: staff.staffid }
      })

      const employeeCode = `CRM-${staff.staffid}`

      if (!employee) {
        employee = await prisma.employee.create({
          data: {
            userId: user.id,
            employeeCode,
            bdNumber: staff.staffid,
            joinDate: staff.joining_date ? new Date(staff.joining_date) : null,
            designation: staff.Designation || null,
            status: EmployeeStatus.ACTIVE,
          }
        })
        result.employeesCreated++
        console.log(`✅ Created employee record for ${fullName} (BD#${staff.staffid})`)
      } else {
        // Update employee if needed
        const needsEmployeeUpdate = 
          employee.employeeCode !== employeeCode || 
          employee.designation !== staff.Designation ||
          employee.userId !== user.id

        if (needsEmployeeUpdate) {
          await prisma.employee.update({
            where: { id: employee.id },
            data: {
              employeeCode,
              designation: staff.Designation || null,
              userId: user.id,
            }
          })
          result.employeesUpdated++
        }
      }

      // 3. Handle team relationships (for next phase)
      // We'll create teams based on team_leader relationships in phase 2
    }

    // Phase 2: Create teams based on team_leader hierarchy
    // This is a simplified version - we'll expand this in future iterations
    if (staffRows.length > 0) {
      const teamLeads = staffRows.filter(s => s.level === 1 || s.team_leader > 0)
      for (const tl of teamLeads) {
        const tlUser = await prisma.user.findFirst({
          where: { employee: { bdNumber: tl.staffid } }
        })
        
        if (tlUser) {
          const teamName = `${tl.firstname} ${tl.lastname}'s Team`
          
          let team = await prisma.team.findFirst({
            where: { teamLeadId: tlUser.id }
          })

          if (!team) {
            team = await prisma.team.create({
              data: {
                name: teamName,
                salesHeadId: tlUser.id, // For now, TL is also sales head
                teamLeadId: tlUser.id,
              }
            })
            result.teamsCreated++
            console.log(`✅ Created team: ${teamName}`)
          }
        }
      }
    }

    console.log(`✅ Staff sync completed: 
      Users: ${result.usersCreated} created, ${result.usersUpdated} updated
      Employees: ${result.employeesCreated} created, ${result.employeesUpdated} updated
      Teams: ${result.teamsCreated} created, ${result.teamsUpdated} updated`)

    return result

  } catch (error) {
    console.error('❌ Staff sync failed:', error)
    throw error
  }
}

// For direct script usage
if (require.main === module) {
  syncStaffFromMySQL()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
