import type { CharacterChat, ChatMessage, SendMessageResponse } from '@english-coach/shared'
import { buildSummarySystem, buildSummaryUser, buildTeacherMessages, buildTeacherSystem, parseTeacherReply } from '../ai/prompts'
import { guardedProvider } from '../ai/usage'
import {
  countCharacterMessages,
  countMessagesByRole,
  createConversation,
  getCharacter,
  getConversation,
  getLatestCharacterConversation,
  getProfile,
  getTeacherConfig,
  getUserSkills,
  insertMessage,
  listConversations,
  listMessages,
  listTopErrors,
  markCharacterUsed,
  parseCharacterConfig,
  saveConversationSummary,
  toCharacterDetail,
  toChatMessage,
  toConversation,
  upsertLearnerError,
  type CharacterRow,
} from '../db/queries'
import { requireCharacter } from './characters'
import type { Env } from '../env'
import { ApiError, json, readJsonBody, readJsonBodyOrEmpty } from '../lib/http'
import type { RouteHandler } from '../lib/router'
import { requiredString } from '../lib/validate'
import type { AIProvider } from '../ai/types'

/** Cuántos mensajes recientes van completos al modelo. El resto va en el resumen. */
const RECENT_MESSAGES = 8
/** Cada cuántos mensajes del alumno se reescribe el resumen. */
const SUMMARY_EVERY = 6

export const listConversationsRoute: RouteHandler = async ({ env, userId }) => {
  return json(await listConversations(env.DB, userId))
}

/**
 * Abre la charla de un personaje: la última que tuviste con él, o una nueva
 * con su saludo. Todo en una llamada, que la pantalla no tiene que adivinar.
 */
export const openCharacterChatRoute: RouteHandler = async ({ env, userId, params }) => {
  const character = await requireCharacter(env, userId, params.id as string)
  await markCharacterUsed(env.DB, userId, character.id)

  const existing = await getLatestCharacterConversation(env.DB, userId, character.id)
  const conversation = existing
    ? toConversation(existing)
    : await startConversationWithCharacter(env, userId, character)

  const [messages, messageCount] = await Promise.all([
    listMessages(env.DB, conversation.id, 60),
    countCharacterMessages(env.DB, userId, character.id),
  ])

  const data: CharacterChat = {
    character: toCharacterDetail(character, messageCount),
    conversation,
    messages: messages.map(toChatMessage),
  }
  return json({ data })
}

/** "Otra charla": empieza de cero con el mismo personaje, sin borrar la anterior. */
export const newCharacterChatRoute: RouteHandler = async ({ env, userId, params }) => {
  const character = await requireCharacter(env, userId, params.id as string)
  await markCharacterUsed(env.DB, userId, character.id)
  const conversation = await startConversationWithCharacter(env, userId, character)
  const messages = await listMessages(env.DB, conversation.id, 60)
  return json({ data: { conversation, messages: messages.map(toChatMessage) } })
}

/** Crea la charla del personaje y la abre con su saludo, si tiene uno. */
async function startConversationWithCharacter(
  env: Env,
  userId: string,
  character: CharacterRow,
) {
  const config = parseCharacterConfig(character)
  const conversation = await createConversation(
    env.DB,
    userId,
    `Charla con ${character.name}`,
    character.id,
  )

  if (config.greeting) {
    const greeting = await insertMessage(env.DB, {
      conversationId: conversation.id,
      role: 'assistant',
      content: config.greeting,
    })
    conversation.lastMessageAt = greeting.createdAt
  }

  return conversation
}

/** La ficha que manda en esta charla: la del personaje, o la del profe de siempre. */
async function conversationConfig(
  env: Env,
  userId: string,
  conversation: { character_id: string | null },
) {
  if (!conversation.character_id) return getTeacherConfig(env.DB, userId)
  const row = await getCharacter(env.DB, userId, conversation.character_id)
  // Si el personaje ya no existe, la charla sigue con el profe por defecto.
  return row ? parseCharacterConfig(row) : getTeacherConfig(env.DB, userId)
}

export const createConversationRoute: RouteHandler = async ({ req, env, userId }) => {
  const body = await readJsonBodyOrEmpty(req)
  const characterId = typeof body.characterId === 'string' && body.characterId ? body.characterId : null

  if (characterId) {
    const character = await requireCharacter(env, userId, characterId)
    await markCharacterUsed(env.DB, userId, character.id)
    return json(await startConversationWithCharacter(env, userId, character))
  }

  const config = await getTeacherConfig(env.DB, userId)
  const conversation = await createConversation(env.DB, userId, `Charla con ${config.name}`)

  // El saludo del personaje abre la charla, así la pantalla no arranca vacía.
  if (config.greeting) {
    const greeting = await insertMessage(env.DB, {
      conversationId: conversation.id,
      role: 'assistant',
      content: config.greeting,
    })
    conversation.lastMessageAt = greeting.createdAt
  }

  return json(conversation)
}

export const listMessagesRoute: RouteHandler = async ({ env, userId, params }) => {
  const conversationId = params.id as string
  const conversation = await getConversation(env.DB, userId, conversationId)
  if (!conversation) throw new ApiError(404, 'conversation_not_found', 'No encuentro esa charla.')

  const rows = await listMessages(env.DB, conversationId, 60)
  const messages: ChatMessage[] = rows.map(toChatMessage)
  return json(messages)
}

async function refreshSummary(env: Env, provider: AIProvider, conversationId: string): Promise<void> {
  const rows = await listMessages(env.DB, conversationId, 20)
  const transcript = rows
    .map((row) => `${row.role === 'assistant' ? 'Teacher' : 'Student'}: ${row.content}`)
    .join('\n')

  const result = await provider.chat({
    tag: 'summary',
    system: buildSummarySystem(),
    messages: buildSummaryUser(transcript.slice(-4000)),
    temperature: 0.3,
    maxTokens: 200,
  })

  await saveConversationSummary(env.DB, conversationId, result.text.trim(), rows.length)
}

export const sendMessageRoute: RouteHandler = async ({ req, env, ctx, userId, params }) => {
  const conversationId = params.id as string
  const conversation = await getConversation(env.DB, userId, conversationId)
  if (!conversation) throw new ApiError(404, 'conversation_not_found', 'No encuentro esa charla.')

  const body = await readJsonBody(req)
  const content = requiredString(body, 'content', { min: 1, max: 2000 })

  const [config, profile, skills, errors, recentRows] = await Promise.all([
    conversationConfig(env, userId, conversation),
    getProfile(env.DB, userId),
    getUserSkills(env.DB, userId),
    listTopErrors(env.DB, userId, 8),
    listMessages(env.DB, conversationId, RECENT_MESSAGES),
  ])

  const provider = guardedProvider(env)
  const reply = await provider.chat({
    tag: 'teacher',
    system: buildTeacherSystem({
      config,
      profile,
      skills,
      errors,
      conversationSummary: conversation.summary,
    }),
    messages: buildTeacherMessages(
      conversation.summary,
      [
        ...recentRows.map((row) => ({
          role: row.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: row.content,
        })),
        { role: 'user' as const, content },
      ],
    ),
    temperature: 0.85,
    maxTokens: 220,
  })

  const parsed = parseTeacherReply(reply.text)
  const userMessage = await insertMessage(env.DB, { conversationId, role: 'user', content })

  // Los errores que el profesor marcó se guardan para recordarlos después.
  const corrections = []
  for (const correction of parsed.corrections) {
    corrections.push(
      await upsertLearnerError(env.DB, {
        userId,
        skill: correction.skill,
        topic: correction.topic,
        original: correction.original,
        correction: correction.correction,
        explanation: correction.explanation,
      }),
    )
  }

  const savedReply = await insertMessage(env.DB, {
    conversationId,
    role: 'assistant',
    content: parsed.text,
    meta: { provider: reply.provider, model: reply.model, corrections },
  })

  const userMessageCount = await countMessagesByRole(env.DB, conversationId, 'user')
  if (userMessageCount > 0 && userMessageCount % SUMMARY_EVERY === 0) {
    // Fuera del tiempo de respuesta: al usuario no le importa cuándo termina esto.
    ctx.waitUntil(refreshSummary(env, provider, conversationId).catch(() => undefined))
  }

  const response: SendMessageResponse = {
    userMessage,
    reply: { ...savedReply, corrections },
  }
  return json(response)
}
