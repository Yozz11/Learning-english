export type ChatRole = 'user' | 'assistant'

export interface AIMessage {
  role: ChatRole
  content: string
}

/** Para qué se usa la llamada. Va a los logs y lo usa el proveedor de prueba. */
export type AITag = 'teacher' | 'writing' | 'summary'

export interface ChatInput {
  tag: AITag
  system: string
  messages: AIMessage[]
  /** Tope de tokens de la respuesta visible. */
  maxTokens?: number
  temperature?: number
  /** true = pedirle al modelo una respuesta JSON. */
  json?: boolean
}

export interface ChatResult {
  text: string
  provider: string
  model: string
}

/**
 * Lo único que la app sabe de la IA. Cambiar de proveedor es escribir otra
 * implementación de esta interfaz y apuntar AI_PROVIDER a ella.
 */
export interface AIProvider {
  readonly id: string
  chat(input: ChatInput): Promise<ChatResult>
}
