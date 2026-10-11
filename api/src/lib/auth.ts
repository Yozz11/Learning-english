import type { Env } from '../env'
import { ApiError } from './http'

// Sesión sin librerías: un token firmado con HMAC-SHA256 dentro de una cookie
// HttpOnly. La contraseña de la app vive en un secret, nunca en la base de datos.

export const SESSION_COOKIE = 'ec_session'
const SESSION_DAYS = 60
const encoder = new TextEncoder()

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)))
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i += 1) difference |= (a[i] as number) ^ (b[i] as number)
  return difference === 0
}

/** Compara dos textos sin filtrar por tiempo cuánto coinciden. */
export async function secretMatches(secret: string, expected: string, received: string): Promise<boolean> {
  const [a, b] = await Promise.all([hmac(secret, expected), hmac(secret, received)])
  return equalBytes(a, b)
}

export async function createSessionToken(secret: string, userId: string): Promise<string> {
  const payload = bytesToBase64Url(
    encoder.encode(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_DAYS * 86_400_000 })),
  )
  const signature = bytesToBase64Url(await hmac(secret, payload))
  return `${payload}.${signature}`
}

export async function verifySessionToken(secret: string, token: string): Promise<string | null> {
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = await hmac(secret, payload)
  if (!equalBytes(expected, base64UrlToBytes(signature))) return null
  try {
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as {
      uid?: unknown
      exp?: unknown
    }
    if (typeof decoded.uid !== 'string' || typeof decoded.exp !== 'number') return null
    if (decoded.exp < Date.now()) return null
    return decoded.uid
  } catch {
    return null
  }
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=') || null
  }
  return null
}

function cookieAttributes(req: Request): string {
  // Secure solo por HTTPS: en local (http) el navegador descartaría la cookie.
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : ''
  return `HttpOnly; Path=/; SameSite=Lax${secure}`
}

export function sessionCookie(req: Request, token: string): string {
  const maxAge = SESSION_DAYS * 86_400
  return `${SESSION_COOKIE}=${token}; Max-Age=${maxAge}; ${cookieAttributes(req)}`
}

export function clearedCookie(req: Request): string {
  return `${SESSION_COOKIE}=; Max-Age=0; ${cookieAttributes(req)}`
}

function requireSecret(env: Env, name: 'SESSION_SECRET' | 'APP_PASSPHRASE'): string {
  const value = env[name]
  if (!value || value.startsWith('cambiame')) {
    throw new ApiError(500, 'missing_secret', `Falta configurar ${name} en los secretos del Worker.`)
  }
  return value
}

/** Devuelve el id del usuario de la sesión o falla con 401. */
export async function requireUserId(req: Request, env: Env): Promise<string> {
  const token = readCookie(req, SESSION_COOKIE)
  if (!token) throw new ApiError(401, 'unauthorized', 'Necesitas iniciar sesión.')
  const userId = await verifySessionToken(requireSecret(env, 'SESSION_SECRET'), token)
  if (!userId) throw new ApiError(401, 'unauthorized', 'La sesión venció. Entra otra vez.')
  return userId
}

export async function checkPassphrase(env: Env, received: string): Promise<boolean> {
  const secret = requireSecret(env, 'SESSION_SECRET')
  const expected = requireSecret(env, 'APP_PASSPHRASE')
  return secretMatches(secret, expected, received)
}

/** Firma la sesión del usuario y devuelve el valor completo de Set-Cookie. */
export async function sessionCookieFor(req: Request, env: Env, userId: string): Promise<string> {
  const token = await createSessionToken(requireSecret(env, 'SESSION_SECRET'), userId)
  return sessionCookie(req, token)
}
