import type { Env } from '../env'
import { ApiError } from './http'
import { clearLoginAttempts, getLoginAttempt, saveLoginFailure } from '../db/queries'

// Límite de intentos de login: 5 fallos en 15 minutos bloquean esa IP otros
// 15. Se guarda en D1 y no en memoria porque cada petición puede caer en un
// isolate distinto.

const MAX_FAILURES = 5
const WINDOW_MS = 15 * 60 * 1000
const BLOCK_MS = 15 * 60 * 1000

/** IP real detrás del túnel o de Cloudflare. En local no hay ninguna: "local". */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || 'local'
}

/** Corta antes de comparar la contraseña si la IP ya está bloqueada. */
export async function assertLoginAllowed(env: Env, ip: string): Promise<void> {
  const attempt = await getLoginAttempt(env.DB, ip)
  if (!attempt || attempt.blocked_until <= Date.now()) return

  const minutes = Math.max(1, Math.ceil((attempt.blocked_until - Date.now()) / 60000))
  throw new ApiError(
    429,
    'too_many_attempts',
    `Demasiados intentos fallidos. Espera ${minutes} minuto${minutes === 1 ? '' : 's'} y prueba otra vez.`,
  )
}

export async function registerLoginFailure(env: Env, ip: string): Promise<void> {
  const now = Date.now()
  const attempt = await getLoginAttempt(env.DB, ip)
  const expired = !attempt || attempt.blocked_until > 0 || now - attempt.window_start > WINDOW_MS
  const failures = expired ? 1 : attempt.failures + 1
  const windowStart = expired ? now : attempt.window_start

  await saveLoginFailure(env.DB, {
    ip,
    failures,
    windowStart,
    blockedUntil: failures >= MAX_FAILURES ? now + BLOCK_MS : 0,
  })
}

export async function forgetLoginFailures(env: Env, ip: string): Promise<void> {
  await clearLoginAttempts(env.DB, ip)
}
