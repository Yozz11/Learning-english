import { getProvider } from './ai/registry'
import type { Env } from './env'
import { requireUserId } from './lib/auth'
import { toErrorResponse } from './lib/http'
import { createRouter } from './lib/router'
import {
  answerAssessment,
  latestAssessment,
  startAssessment,
} from './routes/assessment'
import { currentSession, login, logout } from './routes/auth'
import {
  createConversationRoute,
  listConversationsRoute,
  listMessagesRoute,
  newCharacterChatRoute,
  openCharacterChatRoute,
  sendMessageRoute,
} from './routes/chat'
import { home } from './routes/home'
import {
  createCharacterRoute,
  favoriteCharacterRoute,
  listCharactersRoute,
  readCharacterRoute,
  updateCharacterRoute,
  useCharacterRoute,
} from './routes/characters'
import { readProfile, saveProfile } from './routes/profile'
import { readTeacher, saveTeacher } from './routes/teacher'

const router = createRouter({ authenticate: requireUserId })

router.publicGet('/api/health', async ({ env }) => {
  const provider = getProvider(env)
  return Response.json({ ok: true, provider: provider.id, model: env.GEMINI_MODEL ?? null })
})

router.publicPost('/api/auth/login', login)
router.publicPost('/api/auth/logout', logout)
router.publicGet('/api/auth/me', currentSession)

router.get('/api/home', home)

router.get('/api/profile', readProfile)
router.put('/api/profile', saveProfile)

router.get('/api/teacher', readTeacher)
router.put('/api/teacher', saveTeacher)

router.get('/api/characters', listCharactersRoute)
router.post('/api/characters', createCharacterRoute)
router.get('/api/characters/:id', readCharacterRoute)
router.put('/api/characters/:id', updateCharacterRoute)
router.post('/api/characters/:id/favorite', favoriteCharacterRoute)
router.post('/api/characters/:id/use', useCharacterRoute)
router.get('/api/characters/:id/chat', openCharacterChatRoute)
router.post('/api/characters/:id/chat', newCharacterChatRoute)

router.post('/api/assessment/start', startAssessment)
router.post('/api/assessment/answer', answerAssessment)
router.get('/api/assessment/latest', latestAssessment)

router.get('/api/conversations', listConversationsRoute)
router.post('/api/conversations', createConversationRoute)
router.get('/api/conversations/:id/messages', listMessagesRoute)
router.post('/api/conversations/:id/messages', sendMessageRoute)

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (!url.pathname.startsWith('/api/')) {
      // Con run_worker_first solo llegamos aquí por /api/*; el resto lo sirven los assets.
      return env.ASSETS.fetch(request)
    }

    try {
      return await router.handle(request, env, ctx)
    } catch (error) {
      return toErrorResponse(error)
    }
  },
}
