import type { TeacherConfig } from '@english-coach/shared'
import { SPANISH_USAGE_OPTIONS } from '@english-coach/shared'
import { json, readJsonBody } from '../lib/http'
import type { RouteHandler } from '../lib/router'
import { getTeacherConfig, upsertTeacherConfig } from '../db/queries'
import { booleanOrNull, boundedInt, oneOf, optionalString, requiredString } from '../lib/validate'

/** Todo lo que se guarda pasa por aquí: el navegador nunca decide la forma final. */
function parseConfig(body: Record<string, unknown>): TeacherConfig {
  return {
    name: requiredString(body, 'name', { max: 40 }),
    personality: requiredString(body, 'personality', { max: 400 }),
    humor: boundedInt(body, 'humor', { min: 0, max: 10 }),
    formality: boundedInt(body, 'formality', { min: 0, max: 10 }),
    severity: boundedInt(body, 'severity', { min: 0, max: 10 }),
    correctionStyle: requiredString(body, 'correctionStyle', { max: 400 }),
    englishLevelMode: oneOf(body, 'englishLevelMode', ['auto', 'fixed'] as const),
    spanishUsage: oneOf(body, 'spanishUsage', SPANISH_USAGE_OPTIONS),
    debateEnabled: booleanOrNull(body, 'debateEnabled'),
    character: optionalString(body, 'character', { max: 60 }) || null,
  }
}

export const readTeacher: RouteHandler = async ({ env, userId }) => {
  return json(await getTeacherConfig(env.DB, userId))
}

export const saveTeacher: RouteHandler = async ({ req, env, userId }) => {
  const body = await readJsonBody(req)
  const config = parseConfig(body)
  await upsertTeacherConfig(env.DB, userId, config)
  return json(config)
}
