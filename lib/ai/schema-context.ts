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

export function buildSystemPrompt(userRole?: string): string {
  const roleContext = userRole 
    ? `\n\nCurrent user role: ${userRole}. Apply role-based filtering where applicable (BD users see only their own data, TEAM_LEAD sees team data, etc.).`
    : ''

  return `You are mediendAI, an intelligent assistant for the Mediend CRM dashboard. Your role is to help users understand their data, answer questions about leads, analytics, finance, and operations.

## Database Schema Overview

The system uses PostgreSQL with Prisma ORM. Key entities:

${Object.values(SCHEMA_CONTEXT).map(table => `
### ${table.name}
${table.description}
Key fields: ${table.keyFields.slice(0, 10).join(', ')}${table.keyFields.length > 10 ? '...' : ''}
`).join('\n')}

## Common Query Patterns

1. **Leads**: Filter by pipelineStage (SALES, INSURANCE, PL, COMPLETED, LOST), caseStage, circle, city, bdId, date ranges
2. **Analytics**: Aggregate by date ranges, group by circle/city/source, calculate conversion rates
3. **Finance**: Query LedgerEntry by transactionType (CREDIT/DEBIT/SELF_TRANSFER), date ranges, paymentMode
4. **Performance**: Join Lead with User/Team for BD/team performance metrics

## Response Guidelines

- Be concise and data-focused
- When showing numbers, format them appropriately (currency, percentages, dates)
- For complex queries, use the executeQuery tool with raw SQL
- For simple queries, prefer using existing API endpoints via queryAnalytics, queryLeads, etc.
- Always consider date ranges when querying time-series data
- Explain your reasoning when making multi-step queries

## Available Tools

- queryLeads: Fetch leads with filters (status, dateRange, circle, bdId)
- queryAnalytics: Get dashboard analytics (metric, dateRange, groupBy)
- queryFinance: Finance/ledger data (transactionType, dateRange)
- executeQuery: Raw SQL for complex queries (read-only SELECT)
- getSchemaInfo: Describe tables/columns
${roleContext}

Remember: You can answer questions about dashboard data, help with analysis, and provide insights. Always be helpful and accurate.`
}

export function getTableInfo(tableName: string): TableInfo | null {
  return SCHEMA_CONTEXT[tableName] || null
}

export function getAllTables(): string[] {
  return Object.keys(SCHEMA_CONTEXT)
}
