import { ApiError } from './http'

// Validación a mano: son pocos campos y así no dependemos de una librería.
// Todo lo que llega del navegador pasa por aquí antes de tocar la base de datos.

function field(body: Record<string, unknown>, name: string): unknown {
  return body[name]
}

export function requiredString(
  body: Record<string, unknown>,
  name: string,
  opts: { min?: number; max?: number } = {},
): string {
  const value = field(body, name)
  if (typeof value !== 'string') {
    throw new ApiError(400, 'invalid_field', `El campo "${name}" debe ser texto.`)
  }
  const trimmed = value.trim()
  if (trimmed.length < (opts.min ?? 1)) {
    throw new ApiError(400, 'invalid_field', `El campo "${name}" está vacío.`)
  }
  if (opts.max !== undefined && trimmed.length > opts.max) {
    throw new ApiError(400, 'invalid_field', `El campo "${name}" es demasiado largo.`)
  }
  return trimmed
}

export function optionalString(
  body: Record<string, unknown>,
  name: string,
  opts: { max?: number } = {},
): string | undefined {
  const value = field(body, name)
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    throw new ApiError(400, 'invalid_field', `El campo "${name}" debe ser texto.`)
  }
  const trimmed = value.trim()
  if (opts.max !== undefined && trimmed.length > opts.max) {
    throw new ApiError(400, 'invalid_field', `El campo "${name}" es demasiado largo.`)
  }
  return trimmed
}

export function boundedInt(
  body: Record<string, unknown>,
  name: string,
  opts: { min: number; max: number },
): number {
  const value = field(body, name)
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiError(400, 'invalid_field', `El campo "${name}" debe ser un número.`)
  }
  const rounded = Math.round(value)
  if (rounded < opts.min || rounded > opts.max) {
    throw new ApiError(400, 'invalid_field', `El campo "${name}" está fuera de rango.`)
  }
  return rounded
}

export function booleanOrNull(body: Record<string, unknown>, name: string): boolean | null {
  const value = field(body, name)
  if (value === undefined || value === null) return null
  if (typeof value !== 'boolean') {
    throw new ApiError(400, 'invalid_field', `El campo "${name}" debe ser verdadero o falso.`)
  }
  return value
}

/** Como booleanOrNull, pero para casillas que siempre tienen un valor. */
export function booleanValue(
  body: Record<string, unknown>,
  name: string,
  fallback: boolean,
): boolean {
  const value = field(body, name)
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'boolean') {
    throw new ApiError(400, 'invalid_field', `El campo "${name}" debe ser verdadero o falso.`)
  }
  return value
}

export function oneOf<T extends string>(
  body: Record<string, unknown>,
  name: string,
  allowed: readonly T[],
): T {
  const value = field(body, name)
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ApiError(400, 'invalid_field', `El campo "${name}" no es una opción válida.`)
  }
  return value as T
}

export function stringList(
  body: Record<string, unknown>,
  name: string,
  opts: { maxItems: number; maxLength: number },
): string[] {
  const value = field(body, name)
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'invalid_field', `El campo "${name}" debe ser una lista.`)
  }
  return value.slice(0, opts.maxItems).map((item) => {
    if (typeof item !== 'string') {
      throw new ApiError(400, 'invalid_field', `Los elementos de "${name}" deben ser texto.`)
    }
    return item.trim().slice(0, opts.maxLength)
  })
}
