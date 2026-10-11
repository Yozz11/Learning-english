import type { Profile } from '@english-coach/shared'
import { json, readJsonBody } from '../lib/http'
import type { RouteHandler } from '../lib/router'
import { getProfile, upsertProfile } from '../db/queries'
import { requiredString, stringList } from '../lib/validate'

const EMPTY_PROFILE: Profile = {
  displayName: '',
  nativeLanguage: 'es',
  goals: [],
  correctionPreference: '',
  onboardedAt: null,
}

export const readProfile: RouteHandler = async ({ env, userId }) => {
  const profile = await getProfile(env.DB, userId)
  return json(profile ?? EMPTY_PROFILE)
}

export const saveProfile: RouteHandler = async ({ req, env, userId }) => {
  const body = await readJsonBody(req)
  const existing = await getProfile(env.DB, userId)

  const profile: Profile = {
    displayName: requiredString(body, 'displayName', { max: 60 }),
    nativeLanguage: requiredString(body, 'nativeLanguage', { max: 20 }),
    goals: stringList(body, 'goals', { maxItems: 6, maxLength: 120 }),
    correctionPreference: requiredString(body, 'correctionPreference', { max: 400 }),
    onboardedAt: existing?.onboardedAt ?? Date.now(),
  }

  await upsertProfile(env.DB, userId, profile)
  return json(profile)
}
