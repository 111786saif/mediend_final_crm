import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections'

export const EMPLOYEE_HIERARCHY_COLLECTION_NAME =
  process.env.TYPESENSE_EMPLOYEE_HIERARCHY_COLLECTION || 'employee-hierarchy'

// Schema for employee hierarchy collection in Typesense
export const employeeHierarchySchema: CollectionCreateSchema = {
  name: EMPLOYEE_HIERARCHY_COLLECTION_NAME,
  fields: [
    { name: 'id', type: 'string' },
    { name: 'userId', type: 'string', facet: true },
    { name: 'employeeId', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'role', type: 'string', facet: true },
    { name: 'teamLeadNumber', type: 'string', optional: true },
    { name: 'subordinateUserIds', type: 'string[]' },
    { name: 'updatedAt', type: 'int64' },
  ],
}

// Typesense document interface for employee hierarchy
export interface EmployeeHierarchyDocument {
  id: string
  userId: string
  employeeId: string
  name: string
  role: string
  teamLeadNumber?: string
  subordinateUserIds: string[]
  updatedAt: number
}
