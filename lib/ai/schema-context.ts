/**
 * Schema context for AI - provides knowledge about database structure
 * This helps the AI understand the data model and generate accurate queries
 */

export interface TableInfo {
  name: string
  description: string
  keyFields: string[]
  relationships: string[]
}

export const SCHEMA_CONTEXT: Record<string, TableInfo> = {
  Lead: {
    name: 'Lead',
    description: 'Patient leads/cases - core entity tracking patient information, treatment details, and financials',
    keyFields: [
      'id', 'leadRef', 'patientName', 'age', 'sex', 'phoneNumber',
      'bdId', 'status', 'pipelineStage', 'caseStage', 'circle', 'city',
      'hospitalName', 'treatment', 'billAmount', 'netProfit', 'conversionDate',
      'source', 'campaignName', 'createdDate'
    ],
    relationships: ['bd (User)', 'insuranceCase', 'plRecord', 'kypSubmission', 'dischargeSheet']
  },
  User: {
    name: 'User',
    description: 'System users - BDs, team leads, department heads, etc.',
    keyFields: ['id', 'email', 'name', 'role'],
    relationships: ['employee (Employee?)', 'createdLeads', 'assignedLeads']
  },
  DepartmentTeam: {
    name: 'DepartmentTeam',
    description: 'Team within a department; BDs are linked via Employee.teamId',
    keyFields: ['id', 'name', 'departmentId', 'teamLeadId'],
    relationships: ['department', 'teamLead (Employee)', 'members (Employee[])']
  },
  InsuranceCase: {
    name: 'InsuranceCase',
    description: 'Insurance case tracking - approval status, amounts, TPA details',
    keyFields: ['id', 'leadId', 'caseStatus', 'approvalAmount', 'submittedAt', 'approvedAt'],
    relationships: ['lead']
  },
  PLRecord: {
    name: 'PLRecord',
    description: 'Profit & Loss records - financial breakdown of completed cases',
    keyFields: [
      'id', 'leadId', 'month', 'surgeryDate', 'status',
      'totalAmount', 'billAmount', 'mediendNetProfit', 'hospitalShareAmount',
      'managerName', 'bdmName', 'patientName', 'treatment', 'hospitalName'
    ],
    relationships: ['lead', 'dischargeSheet']
  },
  DischargeSheet: {
    name: 'DischargeSheet',
    description: 'Discharge records - final case details after patient discharge',
    keyFields: [
      'id', 'leadId', 'dischargeDate', 'surgeryDate', 'status',
      'totalAmount', 'billAmount', 'mediendNetProfit', 'hospitalShareAmount',
      'patientName', 'treatment', 'hospitalName', 'doctorName'
    ],
    relationships: ['lead', 'kypSubmission', 'plRecord']
  },
  OutstandingCase: {
    name: 'OutstandingCase',
    description: 'Outstanding payments tracking - cases with pending payments',
    keyFields: [
      'id', 'leadId', 'month', 'dos', 'status', 'paymentReceived',
      'billAmount', 'settlementAmount', 'outstandingDays', 'patientName'
    ],
    relationships: ['lead']
  },
  LedgerEntry: {
    name: 'LedgerEntry',
    description: 'Finance ledger entries - all financial transactions (CREDIT/DEBIT/SELF_TRANSFER)',
    keyFields: [
      'id', 'serialNumber', 'transactionType', 'transactionDate',
      'partyId', 'description', 'headId', 'paymentAmount', 'receivedAmount',
      'paymentModeId', 'status', 'openingBalance', 'currentBalance'
    ],
    relationships: ['party', 'head', 'paymentMode', 'createdBy']
  },
  KYPSubmission: {
    name: 'KYPSubmission',
    description: 'Know Your Patient submissions - patient documents and insurance details',
    keyFields: ['id', 'leadId', 'status', 'submittedAt', 'aadhar', 'pan', 'insuranceCard'],
    relationships: ['lead', 'preAuthData', 'followUpData']
  },
  PreAuthorization: {
    name: 'PreAuthorization',
    description: 'Pre-authorization requests - insurance pre-auth approval workflow',
    keyFields: [
      'id', 'kypSubmissionId', 'sumInsured', 'roomRent', 'capping',
      'approvalStatus', 'preAuthRaisedAt', 'handledAt'
    ],
    relationships: ['kypSubmission', 'queries']
  },
  Task: {
    name: 'Task',
    description: 'Task management - assigned tasks with due dates and priorities',
    keyFields: ['id', 'title', 'description', 'dueDate', 'priority', 'status', 'assigneeId', 'createdById'],
    relationships: ['assignee', 'createdBy']
  },
  Target: {
    name: 'Target',
    description: 'Sales targets - BD and team targets for leads, profit, bill amount, surgeries',
    keyFields: [
      'id', 'targetType', 'targetForId', 'teamId', 'periodType',
      'periodStartDate', 'periodEndDate', 'metric', 'targetValue'
    ],
    relationships: ['team', 'bonusRules']
  },
  Employee: {
    name: 'Employee',
    description: 'Employee records - HRMS employee information',
    keyFields: ['id', 'userId', 'employeeCode', 'joinDate', 'salary', 'departmentId', 'teamId'],
    relationships: ['user', 'department', 'team']
  },
  LeaveRequest: {
    name: 'LeaveRequest',
    description: 'Leave applications - employee leave requests',
    keyFields: ['id', 'employeeId', 'leaveTypeId', 'startDate', 'endDate', 'days', 'status'],
    relationships: ['employee', 'leaveType', 'approvedBy']
  },
  PayrollRecord: {
    name: 'PayrollRecord',
    description: 'Payroll records - employee salary and component breakdowns',
    keyFields: ['id', 'employeeId', 'month', 'year', 'disbursedAt', 'basicSalary', 'grossSalary', 'netSalary'],
    relationships: ['employee', 'components']
  },
}

export function buildSystemPrompt(
  userRole?: string,
  dateRange?: { from?: string; to?: string }
): string {
  const roleContext = userRole
    ? `\nCurrent user role: ${userRole}. Apply role-based filtering where applicable (BD users see only their own data, TEAM_LEAD sees team data, etc.).`
    : ''

  const today = new Date().toISOString().split('T')[0]
  const dateFrom = dateRange?.from ? new Date(dateRange.from).toISOString().split('T')[0] : today
  const dateTo = dateRange?.to ? new Date(dateRange.to).toISOString().split('T')[0] : today

  return `You are mediendAI, an intelligent assistant for the Mediend CRM dashboard. Your role is to help users understand their data, answer questions about leads, analytics, finance, and operations, and provide strategic business advice.

## Current Context
- Today's date: ${today}
- Selected date range: ${dateFrom} to ${dateTo}
- IMPORTANT: Always use this date range when querying data unless the user explicitly asks for a different period. For strategic/yearly questions, expand the range as needed.
${roleContext}

## Database Schema Overview

The system uses PostgreSQL with Prisma ORM. Key entities:

${Object.values(SCHEMA_CONTEXT).map(table => `
### ${table.name}
${table.description}
Key fields: ${table.keyFields.join(', ')}
Relationships: ${table.relationships.join(', ')}
`).join('\n')}

## Key Enums & Values

- **pipelineStage**: SALES, INSURANCE, PL, COMPLETED, LOST
- **caseStage**: NEW_LEAD, CASE_DISCUSSION, KYP_PENDING, KYP_SUBMITTED, PRE_AUTH, IPD_ADMITTED, DISCHARGED, PL_SUBMITTED, BILL_SETTLEMENT
- **Lead.status**: ACTIVE, CONVERTED, CLOSED, FOLLOW_UP, etc.
- **transactionType**: CREDIT, DEBIT, SELF_TRANSFER
- **OutstandingCase.status**: PENDING, PARTIALLY_PAID, SETTLED

## Query Strategy

1. **Use executeQuery (raw SQL) as your primary tool** for anything involving joins, aggregations, counts, grouping, or complex filters. It gives you full SQL power. Always use read-only SELECT queries.
2. Use queryLeads only for simple lead listing with basic filters.
3. Use queryAnalytics only for pre-built dashboard metrics.
4. Use queryFinance only for simple ledger entry listing.
5. Use getSchemaInfo when you need to discover column names before writing SQL.

## SQL Tips
- Table names in SQL are quoted and match Prisma model names: "Lead", "User", "LedgerEntry", "OutstandingCase", "PLRecord", "DischargeSheet", "Employee", "DepartmentTeam", etc.
- Foreign keys follow the pattern: "bdId", "leadId", "employeeId", etc.
- Date columns: "createdDate", "conversionDate", "transactionDate", "surgeryDate", etc.
- Currency amounts are stored as DECIMAL: "billAmount", "netProfit", "ticketSize", "paymentAmount", "receivedAmount", etc.
- Always use the selected date range (${dateFrom} to ${dateTo}) unless the user specifies otherwise.

## Response Guidelines

- Be concise and data-focused. Present data in tables or bullet points.
- Format currency as ₹X.XX lakh/crore where appropriate.
- When a query returns no data, say so clearly and suggest what the user can try differently (different date range, different filters).
- For strategic questions (e.g., "how to make 12 crores"), first pull current performance data, then calculate projections and give actionable steps with specific numbers.
- Break down complex goals into monthly/weekly targets with clear math.
- Always show your work: what data you found, what calculations you did, and what conclusions you drew.

Remember: You have access to the full database via SQL. Don't say "no data available" without first trying executeQuery with a broader date range or fewer filters.`
}

export function getTableInfo(tableName: string): TableInfo | null {
  return SCHEMA_CONTEXT[tableName] || null
}

export function getAllTables(): string[] {
  return Object.keys(SCHEMA_CONTEXT)
}
