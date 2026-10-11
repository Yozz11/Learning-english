import { countAiCalls, registerAiCall, utcDay } from '../db/queries'
import type { Env } from '../env'
import { ApiError } from '../lib/http'
import { getProvider } from './registry'
import type { AIProvider, ChatInput, ChatResult } from './types'

// Tope diario de llamadas a la IA. El plan gratis de Gemini aguanta más, pero
// un bug (un bucle, un reintento tonto) no debe gastar la cuota en una tarde.

/** Tope por defecto. Se cambia con la variable AI_DAILY_LIMIT. */
export const DEFAULT_DAILY_AI_LIMIT = 200

export function dailyAiLimit(env: Env): number {
  const value = Number(env.AI_DAILY_LIMIT)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_DAILY_AI_LIMIT
}

/**
 * Igual que getProvider, pero cada llamada suma al contador del día y al
 * pasarse del tope devuelve un error claro en vez de gastar cuota.
 */
export function guardedProvider(env: Env): AIProvider {
  const provider = getProvider(env)
  const limit = dailyAiLimit(env)

  return {
    id: provider.id,
    async chat(input) {
      const day = utcDay()
      const used = await countAiCalls(env.DB, day)

      if (used >= limit) {
        throw new ApiError(
          429,
          'ai_daily_limit',
          `Se acabaron las ${limit} llamadas de IA de hoy. Se reinician a las 00:00 UTC.`,
        )
      }

      await registerAiCall(env.DB, day)
      return provider.chat(input)
    },
  }
}
