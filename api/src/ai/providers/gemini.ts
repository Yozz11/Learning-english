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
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          temperature: input.temperature ?? 0.6,
          // Margen extra: el modelo puede gastar tokens pensando antes de responder.
          maxOutputTokens: (input.maxTokens ?? 512) + 900,
          ...(input.json ? { responseMimeType: 'application/json' } : {}),
        },
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
        },
      )

      let data: GeminiResponse
      try {
        data = (await response.json()) as GeminiResponse
      } catch {
        throw new ApiError(502, 'ai_bad_response', 'El proveedor de IA respondió algo ilegible.')
      }

      if (!response.ok) {
        const detail = data.error?.message ?? `HTTP ${response.status}`
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
          throw new ApiError(502, 'ai_truncated', 'El modelo se quedó sin espacio. Prueba con un mensaje más corto.')
        }
        throw new ApiError(502, 'ai_empty', 'El modelo no devolvió texto.')
      }

      return { text, provider: 'gemini', model }
    },
  }
}
