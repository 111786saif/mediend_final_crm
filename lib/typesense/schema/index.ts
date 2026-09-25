import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections'
import { salesPipelineSchema, SALES_PIPELINE_COLLECTION_NAME } from './sales-pipeline'
import { employeeHierarchySchema, EMPLOYEE_HIERARCHY_COLLECTION_NAME } from './employee-hierarchy'

export * from './sales-pipeline'
export * from './employee-hierarchy'

// Registry of all collection schemas in Typesense. Add future schemas here.
export const ALL_TYPESENSE_SCHEMAS: Record<string, CollectionCreateSchema> = {
  [SALES_PIPELINE_COLLECTION_NAME]: salesPipelineSchema,
  [EMPLOYEE_HIERARCHY_COLLECTION_NAME]: employeeHierarchySchema,
}
