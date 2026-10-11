/** Errores de la API. `code` es estable para el frontend; `message` es para mostrar. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'ApiError'
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return json({ error: error.code, message: error.message }, { status: error.status })
  }
  // No filtramos detalles internos al cliente; quedan en los logs del Worker.
  console.error('unexpected error', error)
  return json(
    { error: 'internal_error', message: 'Algo falló de mi lado. Intenta otra vez.' },
    { status: 500 },
  )
}

/** Lee el cuerpo JSON y falla con 400 si no es un objeto válido. */
export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text()
  return parseJsonObject(text)
}

/** Igual que `readJsonBody`, pero un cuerpo vacío se lee como `{}`. */
export async function readJsonBodyOrEmpty(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text()
  if (text.trim() === '') return {}
  return parseJsonObject(text)
}

function parseJsonObject(text: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new ApiError(400, 'invalid_json', 'El cuerpo de la petición debe ser JSON.')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ApiError(400, 'invalid_body', 'Se esperaba un objeto JSON.')
  }
  return parsed as Record<string, unknown>
}
