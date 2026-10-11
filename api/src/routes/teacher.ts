import type { TeacherConfig } from '@english-coach/shared'
import { json, readJsonBody } from '../lib/http'
import type { RouteHandler } from '../lib/router'
import { parseTeacherConfig } from '../lib/teacher-config'
import { getTeacherConfig, upsertTeacherConfig } from '../db/queries'

// Esta es la ficha suelta de siempre ("Mi profesor"). Los personajes de la
// biblioteca guardan su ficha en la tabla `characters`; esto se queda por
// compatibilidad con las charlas viejas.

export const readTeacher: RouteHandler = async ({ env, userId }) => {
  return json(await getTeacherConfig(env.DB, userId))
}

export const saveTeacher: RouteHandler = async ({ req, env, userId }) => {
  const config: TeacherConfig = parseTeacherConfig(await readJsonBody(req))
  await upsertTeacherConfig(env.DB, userId, config)
  return json(config)
}
