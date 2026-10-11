export type ChatRole = 'user' | 'assistant'

/** Un archivo que acompaña al mensaje (audio, PDF o imagen). */
export interface AIFile {
  mimeType: string
  /** El archivo en base64, sin la cabecera `data:...`. */
  base64: string
}

export interface AIMessage {
  role: ChatRole
  content: string
  /** Archivos que van pegados a este mensaje. No todos los proveedores los usan. */
  files?: AIFile[]
}

/** Para qué se usa la llamada. Va a los logs y lo usa el proveedor de prueba. */
export type AITag = 'teacher' | 'writing' | 'summary' | 'upload'

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
