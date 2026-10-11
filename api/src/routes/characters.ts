import type { TeacherConfig } from '@english-coach/shared'
import type { Env } from '../env'
import { ApiError, json, readJsonBody } from '../lib/http'
import type { RouteHandler } from '../lib/router'
import { parseTeacherConfig } from '../lib/teacher-config'
import { booleanValue } from '../lib/validate'
import {
  countCharacterMessages,
  ensureCharacters,
  getCharacter,
  insertCharacter,
  listCharacterCards,
  markCharacterUsed,
  markCharacterViewed,
  setCharacterFavorite,
  toCharacterDetail,
  updateCharacter,
} from '../db/queries'

/** La biblioteca del usuario. La primera vez se estrena sola. */
export const listCharactersRoute: RouteHandler = async ({ env, userId }) => {
  await ensureCharacters(env.DB, userId)
  return json({ data: await listCharacterCards(env.DB, userId) })
}

/** El personaje del usuario, o 404. Lo usan también las rutas de la charla. */
export async function requireCharacter(env: Env, userId: string, id: string) {
  const row = await getCharacter(env.DB, userId, id)
  if (!row) throw new ApiError(404, 'not_found', 'Ese personaje no existe.')
  return row
}

export const readCharacterRoute: RouteHandler = async ({ env, userId, params }) => {
  const row = await requireCharacter(env, userId, params.id as string)
  // Abrir la ficha quita la novedad sin ver.
  await markCharacterViewed(env.DB, userId, row.id)
  const messages = await countCharacterMessages(env.DB, userId, row.id)
  return json({ data: toCharacterDetail(row, messages) })
}

export const createCharacterRoute: RouteHandler = async ({ req, env, userId }) => {
  const config = parseTeacherConfig(await readJsonBody(req))
  const row = await insertCharacter(env.DB, userId, { config })
  return json({ data: toCharacterDetail(row, 0) }, { status: 201 })
}

export const updateCharacterRoute: RouteHandler = async ({ req, env, userId, params }) => {
  const id = params.id as string
  await requireCharacter(env, userId, id)
  const config: TeacherConfig = parseTeacherConfig(await readJsonBody(req))
  await updateCharacter(env.DB, userId, id, config)
  const row = await requireCharacter(env, userId, id)
  const messages = await countCharacterMessages(env.DB, userId, id)
  return json({ data: toCharacterDetail(row, messages) })
}

/** Marca o desmarca el personaje como favorito (la pestaña "Siguiendo"). */
export const favoriteCharacterRoute: RouteHandler = async ({ req, env, userId, params }) => {
  const id = params.id as string
  await requireCharacter(env, userId, id)
  const body = await readJsonBody(req)
  const favorite = booleanValue(body, 'favorite', false)
  await setCharacterFavorite(env.DB, userId, id, favorite)
  const row = await requireCharacter(env, userId, id)
  const messages = await countCharacterMessages(env.DB, userId, id)
  return json({ data: toCharacterDetail(row, messages) })
}

/** Se llama al abrir la charla: ordena "Para ti" por lo último que usaste. */
export const useCharacterRoute: RouteHandler = async ({ env, userId, params }) => {
  const row = await requireCharacter(env, userId, params.id as string)
  await markCharacterUsed(env.DB, userId, row.id)
  return json({ ok: true })
}
