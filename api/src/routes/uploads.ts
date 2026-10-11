import type { UploadMode } from '@english-coach/shared'
import { guardedProvider } from '../ai/usage'
import { buildUploadSystem, buildUploadUser } from '../ai/prompts'
import type { AIFile, AIMessage } from '../ai/types'
import { ApiError, json } from '../lib/http'
import type { RouteHandler } from '../lib/router'
import {
  deleteUpload,
  getUpload,
  insertUpload,
  listUploads,
  toUploadRecord,
} from '../db/queries'

/*
 * Subir un archivo para transcribirlo o traducirlo.
 *
 * El archivo viaja en la petición y se manda a la IA en la misma llamada: no se
 * guarda en ningún sitio, solo el texto que devuelve el modelo. Así no hace
 * falta un almacén de archivos (R2) ni pagar por él.
 */

/**
 * Tope de peso. Gemini acepta unos 20 MB en total y el archivo viaja en base64,
 * que pesa un tercio más; 12 MB entran con margen.
 */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

/** Lo que el modelo sabe leer. */
const ALLOWED_MIME = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/flac',
  'audio/x-flac',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/webm',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
]

/** Los que se mandan como texto dentro del mensaje, no como archivo pegado. */
const TEXT_MIME = ['text/plain', 'text/markdown', 'text/csv']

function parseMode(value: string | null): UploadMode {
  if (value === 'transcribe' || value === 'translate') return value
  if (value === null || value.trim() === '') return 'translate'
  throw new ApiError(400, 'invalid_mode', 'El modo tiene que ser "transcribe" o "translate".')
}

/** base64 sin reventar la pila con archivos grandes. */
function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

function assertAllowed(mimeType: string): void {
  if (!ALLOWED_MIME.includes(mimeType)) {
    throw new ApiError(
      415,
      'unsupported_type',
      `No puedo leer archivos "${mimeType}". Acepto audio (mp3, wav, m4a, ogg), PDF, texto e imágenes.`,
    )
  }
}

/** Sube el archivo, se lo pasa a la IA y guarda el texto que devuelve. */
export const createUploadRoute: RouteHandler = async ({ req, env, userId }) => {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    throw new ApiError(400, 'invalid_form', 'La subida tiene que venir como formulario con el archivo.')
  }

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) {
    throw new ApiError(400, 'missing_file', 'No llegó ningún archivo.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(
      413,
      'file_too_big',
      'El archivo pesa más de 12 MB. Recórtalo o mándalo en partes: el plan gratis no acepta más.',
    )
  }

  const mimeType = (file.type || 'application/octet-stream').toLowerCase()
  assertAllowed(mimeType)

  const mode = parseMode(typeof form.get('mode') === 'string' ? (form.get('mode') as string) : null)
  const fileName = (file.name || 'archivo').slice(0, 120)

  let messages: AIMessage[]
  if (TEXT_MIME.includes(mimeType)) {
    messages = buildUploadUser({ fileName, mimeType, mode, text: await file.text() })
  } else {
    const files: AIFile[] = [{ mimeType, base64: toBase64(new Uint8Array(await file.arrayBuffer())) }]
    const [message] = buildUploadUser({ fileName, mimeType, mode, text: null })
    messages = [{ ...(message as AIMessage), files }]
  }

  const provider = guardedProvider(env)
  const result = await provider.chat({
    tag: 'upload',
    system: buildUploadSystem(mode),
    messages,
    // Una transcripción larga ocupa bastante: aquí el tope va holgado.
    maxTokens: 4096,
    temperature: 0.2,
    json: true,
  })

  const row = await insertUpload(env.DB, userId, {
    fileName,
    mimeType,
    size: file.size,
    mode,
    result: result.text,
  })

  return json({ data: toUploadRecord(row) }, { status: 201 })
}

export const listUploadsRoute: RouteHandler = async ({ env, userId }) => {
  const rows = await listUploads(env.DB, userId)
  return json({ data: rows.map(toUploadRecord) })
}

export const readUploadRoute: RouteHandler = async ({ env, userId, params }) => {
  const row = await getUpload(env.DB, userId, params.id as string)
  if (!row) throw new ApiError(404, 'not_found', 'Ese archivo no está en tu historial.')
  return json({ data: toUploadRecord(row) })
}

export const deleteUploadRoute: RouteHandler = async ({ env, userId, params }) => {
  const deleted = await deleteUpload(env.DB, userId, params.id as string)
  if (!deleted) throw new ApiError(404, 'not_found', 'Ese archivo no está en tu historial.')
  return json({ ok: true })
}
