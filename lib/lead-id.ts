import { z } from 'zod'

/** Accept numeric URL/form values without accepting partial numbers or unsafe IDs. */
export const leadIdSchema = z.union([
  z.number(),
  z.string().regex(/^[1-9]\d*$/).transform(Number),
]).pipe(z.number().int().positive().max(2147483647))

export function parseLeadId(value: unknown): number {
  return leadIdSchema.parse(value)
}

export function optionalLeadId(value: unknown): number | undefined {
  return value == null || value === '' ? undefined : parseLeadId(value)
}
