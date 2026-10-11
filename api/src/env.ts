export interface Env {
  /** Base de datos D1. */
  DB: D1Database
  /** Archivos de la web ya compilada. */
  ASSETS: Fetcher

  AI_PROVIDER?: string
  GEMINI_MODEL?: string
  GEMINI_API_KEY?: string

  /** Contraseña de entrada a la app. */
  APP_PASSPHRASE?: string
  /** Secreto que firma la cookie de sesión. */
  SESSION_SECRET?: string
}
