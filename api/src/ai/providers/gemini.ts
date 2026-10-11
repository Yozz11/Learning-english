import { ApiError } from '../../lib/http'
import type { AIProvider, ChatInput, ChatResult } from '../types'

interface GeminiPart {
  text?: string
  thought?: boolean
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] }
    finishReason?: string
  }[]
  error?: { message?: string; status?: string }
  promptFeedback?: { blockReason?: string }
}

/**
 * Gemini a veces contesta "high demand / overloaded" (503) sin que haya nada
 * roto: es un pico puntual. Vale la pena reintentar antes de molestar al
 * usuario; se ve seguido cuando el modelo está muy pedido.
 */
function isBusy(status: number, detail: string): boolean {
  if (status === 503 || status === 500 || status === 502) return true
  return /high demand|overloaded|UNAVAILABLE|try again later/i.test(detail)
}

/** Espera entre reintentos: corta, para no colgar la respuesta del chat. */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const MAX_ATTEMPTS = 3

export function geminiProvider(apiKey: string, model: string): AIProvider {
  return {
    id: 'gemini',

    async chat(input: ChatInput): Promise<ChatResult> {
      if (!apiKey) {
        throw new ApiError(
          500,
          'missing_gemini_key',
          'Falta GEMINI_API_KEY. Sin ella no puedo hablar con el profesor.',
        )
      }

      const body = {
        systemInstruction: { parts: [{ text: input.system }] },
        contents: input.messages.map((message) => ({
          role: message.role === 'user' ? 'user' : 'model',
          parts: [
            { text: message.content },
            // Los archivos van como datos pegados al mensaje. Gemini acepta
            // audio, PDF e imágenes así, sin subirlos antes a ningún sitio.
            ...(message.files ?? []).map((file) => ({
              inlineData: { mimeType: file.mimeType, data: file.base64 },
            })),
          ],
        })),
        generationConfig: {
          temperature: input.temperature ?? 0.6,
          // Margen extra: el modelo puede gastar tokens pensando antes de responder.
          maxOutputTokens: (input.maxTokens ?? 512) + 900,
          ...(input.json ? { responseMimeType: 'application/json' } : {}),
        },
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
      let lastDetail = ''

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        if (attempt > 0) await wait(600 * attempt)

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
        })

        let data: GeminiResponse
        try {
          data = (await response.json()) as GeminiResponse
        } catch {
          throw new ApiError(502, 'ai_bad_response', 'El proveedor de IA respondió algo ilegible.')
        }

        if (!response.ok) {
          const detail = data.error?.message ?? `HTTP ${response.status}`

          // Cuota agotada o demasiadas peticiones por minuto: mensaje claro en
          // vez del error crudo de Google. Reintentar aquí no sirve de nada.
          if (response.status === 429 || data.error?.status === 'RESOURCE_EXHAUSTED') {
            throw new ApiError(
              429,
              'ai_quota_exhausted',
              'Se acabó la cuota gratis de Gemini por hoy. Vuelve mañana o espera un minuto si fue solo un pico.',
            )
          }

          // Pico de demanda: se reintenta; si sigue igual, se explica en español.
          if (isBusy(response.status, detail)) {
            lastDetail = detail
            continue
          }

          throw new ApiError(502, 'ai_error', `El proveedor de IA falló: ${detail}`)
        }

        const candidate = data.candidates?.[0]
        const text = (candidate?.content?.parts ?? [])
          .filter((part) => part.thought !== true)
          .map((part) => part.text ?? '')
          .join('')
          .trim()

        if (!text) {
          if (data.promptFeedback?.blockReason) {
            throw new ApiError(502, 'ai_blocked', 'El modelo bloqueó la respuesta. Reformula el mensaje.')
          }
          if (candidate?.finishReason === 'MAX_TOKENS') {
            throw new ApiError(
              502,
              'ai_truncated',
              'El modelo se quedó sin espacio. Prueba con un mensaje más corto.',
            )
          }
          throw new ApiError(502, 'ai_empty', 'El modelo no devolvió texto.')
        }

        return { text, provider: 'gemini', model }
      }

      console.error('gemini saturado', lastDetail)
      throw new ApiError(
        503,
        'ai_busy',
        'El modelo está saturado en este momento. Espera unos segundos y vuelve a intentarlo.',
      )
    },
  }
}
