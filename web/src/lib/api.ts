import type { ApiErrorBody } from '@english-coach/shared'

/** Error con el mensaje ya listo para mostrar. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  // Con FormData el navegador pone él mismo el content-type con su frontera.
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' })
  const raw = await response.text()

  let parsed: unknown = null
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
  }

  if (!response.ok) {
    const body = parsed as ApiErrorBody | null
    throw new ApiError(
      response.status,
      body?.error ?? 'unknown_error',
      body?.message ?? 'Algo falló. Intenta otra vez.',
    )
  }

  return parsed as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  /** Sube un archivo: el navegador arma el formulario con su frontera. */
  upload: <T>(path: string, body: FormData) => request<T>(path, { method: 'POST', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/** Texto para mostrar de cualquier error. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Algo falló. Intenta otra vez.'
}
