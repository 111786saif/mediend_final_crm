import { z } from 'zod'

function emptyToUndefined(value: unknown) {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length === 0 ? undefined : trimmed
  }
  return value
}

function emptyToNull(value: unknown) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  }
  return value
}

export function requiredStringField(
  label: string,
  options: {
    max?: number
    min?: number
    minMessage?: string
  } = {}
) {
  const { max, min = 1, minMessage } = options

  let schema = z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be a string`,
    })
    .trim()
    .min(min, minMessage ?? `${label} is required`)

  if (max !== undefined) {
    schema = schema.max(max, `${label} must be at most ${max} characters`)
  }

  return schema
}

export function optionalStringField(
  label: string,
  options: {
    max?: number
  } = {}
) {
  const { max } = options

  let schema = z.string({
    invalid_type_error: `${label} must be a string`,
  })

  if (max !== undefined) {
    schema = schema.max(max, `${label} must be at most ${max} characters`)
  }

  return z.preprocess(emptyToUndefined, schema.trim().optional())
}

export function nullableOptionalStringField(
  label: string,
  options: {
    max?: number
  } = {}
) {
  const { max } = options

  let schema = z.string({
    invalid_type_error: `${label} must be a string`,
  })

  if (max !== undefined) {
    schema = schema.max(max, `${label} must be at most ${max} characters`)
  }

  return z.preprocess(emptyToNull, schema.trim().nullable().optional())
}

export function emailField(label: string, options: { optional?: boolean } = {}) {
  const base = z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be a string`,
    })
    .trim()
    .min(1, `${label} is required`)
    .email(`${label} must be a valid email`)
    .toLowerCase()

  if (options.optional) {
    return z.preprocess(emptyToUndefined, base.optional())
  }

  return base
}

export function phoneField(label: string, options: { optional?: boolean } = {}) {
  const base = z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be a string`,
    })
    .trim()
    .min(1, `${label} is required`)
    .min(8, `${label} must be at least 8 characters`)
    .max(20, `${label} must be at most 20 characters`)

  if (options.optional) {
    return z.preprocess(emptyToNull, base.nullable().optional())
  }

  return base
}

export function otpField(label: string) {
  return z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be a string`,
    })
    .trim()
    .regex(/^\d{6}$/, `${label} must be exactly 6 digits`)
}

export function optionalIntField(
  label: string,
  options: {
    min?: number
    max?: number
    defaultValue?: number
  } = {}
) {
  const { min, max, defaultValue } = options

  let schema = z
    .number({
      invalid_type_error: `${label} must be a number`,
    })
    .int(`${label} must be a whole number`)

  if (min !== undefined) {
    schema = schema.min(min, `${label} must be at least ${min}`)
  }

  if (max !== undefined) {
    schema = schema.max(max, `${label} must be at most ${max}`)
  }

  const base = z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined
    if (typeof value === 'number') return value
    if (typeof value === 'string') return Number(value)
    return value
  }, schema.optional())

  return defaultValue !== undefined ? base.default(defaultValue) : base
}

export function optionalNumberField(
  label: string,
  options: {
    min?: number
    max?: number
    nullable?: boolean
  } = {}
) {
  const { min, max, nullable = false } = options

  let schema = z.number({
    invalid_type_error: `${label} must be a number`,
  })

  if (min !== undefined) {
    schema = schema.min(min, `${label} must be at least ${min}`)
  }

  if (max !== undefined) {
    schema = schema.max(max, `${label} must be at most ${max}`)
  }

  const wrapped = nullable ? schema.nullable().optional() : schema.optional()

  return z.preprocess((value) => {
    if (value === undefined || value === '') return undefined
    if (value === null) return nullable ? null : undefined
    if (typeof value === 'number') return value
    if (typeof value === 'string') return Number(value)
    return value
  }, wrapped)
}

export function optionalEnumField<const TValues extends [string, ...string[]]>(
  label: string,
  values: TValues,
  defaultValue?: TValues[number]
) {
  const base = z.preprocess(
    emptyToUndefined,
    z.enum(values, {
      invalid_type_error: `${label} is invalid`,
    }).optional()
  )

  return defaultValue !== undefined ? base.default(defaultValue) : base
}

export function booleanStringField(
  label: string,
  options: {
    defaultValue?: boolean
  } = {}
) {
  const base = z.preprocess(
    emptyToUndefined,
    z
      .enum(['true', 'false'], {
        invalid_type_error: `${label} must be true or false`,
      })
      .transform((value) => value === 'true')
      .optional()
  )

  return options.defaultValue !== undefined ? base.default(options.defaultValue) : base
}
