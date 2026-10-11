export interface Env {
  /** Base de datos D1. */
  DB: D1Database
  /** Archivos de la web ya compilada. */
  ASSETS: Fetcher

  AI_PROVIDER?: string
  GEMINI_MODEL?: string
  GEMINI_API_KEY?: string
  /**
   * Dirección de Gemini. No se toca en producción: solo las pruebas la usan
   * para hablar con un Gemini de mentira y poder ver los reintentos.
   */
  GEMINI_BASE_URL?: string
  /** Tope diario de llamadas a la IA (texto, se lee con Number). */
  AI_DAILY_LIMIT?: string

  /** Contraseña de entrada a la app. */
  APP_PASSPHRASE?: string
  /** Secreto que firma la cookie de sesión. */
  SESSION_SECRET?: string
}
