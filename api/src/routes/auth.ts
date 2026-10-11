import type { SessionInfo } from '@english-coach/shared'
import {
  checkPassphrase,
  clearedCookie,
  readCookie,
  sessionCookieFor,
  SESSION_COOKIE,
  verifySessionToken,
} from '../lib/auth'
import { ApiError, json, readJsonBody } from '../lib/http'
import { assertLoginAllowed, clientIp, forgetLoginFailures, registerLoginFailure } from '../lib/attempts'
import type { RouteHandler } from '../lib/router'
import { requiredString } from '../lib/validate'
import { getOrCreateUserId, getProfile, touchUser } from '../db/queries'

export const login: RouteHandler = async ({ req, env }) => {
  const body = await readJsonBody(req)
  const passphrase = requiredString(body, 'passphrase', { min: 1, max: 200 })
  const ip = clientIp(req)

  await assertLoginAllowed(env, ip)

  if (!(await checkPassphrase(env, passphrase))) {
    await registerLoginFailure(env, ip)
    throw new ApiError(401, 'bad_passphrase', 'Esa no es la contraseña.')
  }

  await forgetLoginFailures(env, ip)

  const userId = await getOrCreateUserId(env.DB)
  await touchUser(env.DB, userId)
  const profile = await getProfile(env.DB, userId)
  const cookie = await sessionCookieFor(req, env, userId)

  const info: SessionInfo = {
    authenticated: true,
    userId,
    displayName: profile?.displayName || null,
  }
  return json(info, { headers: { 'set-cookie': cookie } })
}

export const logout: RouteHandler = async ({ req }) => {
  const info: SessionInfo = { authenticated: false, userId: null, displayName: null }
  return json(info, { headers: { 'set-cookie': clearedCookie(req) } })
}

export const currentSession: RouteHandler = async ({ req, env }) => {
  const secret = env.SESSION_SECRET
  const token = readCookie(req, SESSION_COOKIE)
  const info: SessionInfo = { authenticated: false, userId: null, displayName: null }

  if (!secret || !token) return json(info)
  const userId = await verifySessionToken(secret, token)
  if (!userId) return json(info)

  const profile = await getProfile(env.DB, userId)
  return json({ authenticated: true, userId, displayName: profile?.displayName || null } satisfies SessionInfo)
}
