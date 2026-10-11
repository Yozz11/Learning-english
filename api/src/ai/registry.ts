import type { Env } from '../env'
import { ApiError } from '../lib/http'
import { geminiProvider } from './providers/gemini'
import { mockProvider } from './providers/mock'
import type { AIProvider } from './types'

/**
 * Elige el proveedor según AI_PROVIDER. Para añadir Groq, Workers AI u Ollama:
 * escribir el módulo del proveedor y sumar un caso aquí. Nada más cambia.
 */
export function getProvider(env: Env): AIProvider {
  const name = (env.AI_PROVIDER ?? 'gemini').toLowerCase()

  if (name === 'mock') return mockProvider()
  if (name === 'gemini') {
    return geminiProvider(env.GEMINI_API_KEY ?? '', env.GEMINI_MODEL ?? 'gemini-3.6-flash')
  }

  throw new ApiError(500, 'unknown_ai_provider', `El proveedor "${name}" no está implementado.`)
}
