import type { ChatMessage, SendMessageResponse } from '@english-coach/shared'
import { buildSummarySystem, buildSummaryUser, buildTeacherMessages, buildTeacherSystem, parseTeacherReply } from '../ai/prompts'
import { getProvider } from '../ai/registry'
import {
  countMessagesByRole,
  createConversation,
  getConversation,
  getProfile,
  getTeacherConfig,
  getUserSkills,
  insertMessage,
  listConversations,
  listMessages,
  listTopErrors,
  saveConversationSummary,
  toChatMessage,
  upsertLearnerError,
} from '../db/queries'
import type { Env } from '../env'
import { ApiError, json, readJsonBody } from '../lib/http'
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

export const createConversationRoute: RouteHandler = async ({ env, userId }) => {
  const config = await getTeacherConfig(env.DB, userId)
  return json(await createConversation(env.DB, userId, `Charla con ${config.name}`))
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
    getTeacherConfig(env.DB, userId),
    getProfile(env.DB, userId),
    getUserSkills(env.DB, userId),
    listTopErrors(env.DB, userId, 8),
    listMessages(env.DB, conversationId, RECENT_MESSAGES),
  ])

  const provider = getProvider(env)
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
    temperature: 0.7,
    maxTokens: 400,
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

  const assistantMessage = await insertMessage(env.DB, {
    conversationId,
    role: 'assistant',
    content: parsed.text,
    meta: { provider: reply.provider, model: reply.model, corrections },
  })
  assistantMessage.corrections = corrections

  const userMessageCount = await countMessagesByRole(env.DB, conversationId, 'user')
  if (userMessageCount > 0 && userMessageCount % SUMMARY_EVERY === 0) {
    // Fuera del tiempo de respuesta: al usuario no le importa cuándo termina esto.
    ctx.waitUntil(refreshSummary(env, provider, conversationId).catch(() => undefined))
  }

  const response: SendMessageResponse = { userMessage, reply: assistantMessage }
  return json(response)
}
