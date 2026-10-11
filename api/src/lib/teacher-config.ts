import type { TeacherConfig } from '@english-coach/shared'
import { AVATAR_PRESET_IDS, SPANISH_USAGE_OPTIONS, TEACHER_PERSONAS } from '@english-coach/shared'
import { ApiError } from './http'
import {
  booleanOrNull,
  booleanValue,
  boundedInt,
  oneOf,
  optionalInt,
  optionalString,
  requiredString,
} from './validate'

// La ficha del personaje: lo que llega del navegador pasa por aquí antes de
// guardarse. Vive en su propio archivo porque la usan la pantalla de profesor
// de siempre y la de personajes.

/** Una imagen reducida en el navegador ronda los 30 KB; 300 000 caracteres sobra. */
export const AVATAR_MAX_LENGTH = 300_000

/** El avatar es un dibujo de la app o una imagen que subiste tú. Nada más. */
export function parseAvatar(body: Record<string, unknown>): string | null {
  const value = optionalString(body, 'avatar', { max: AVATAR_MAX_LENGTH })
  if (value === undefined || value === '') return null
  if (value.startsWith('data:image/')) return value
  if ((AVATAR_PRESET_IDS as readonly string[]).includes(value)) return value
  throw new ApiError(400, 'invalid_field', 'El avatar debe ser una imagen o uno de los dibujos de la app.')
}

/** El arquetipo solo se usa en la interfaz: si no lo reconocemos, se ignora. */
function parsePersonaId(body: Record<string, unknown>): string | null {
  const value = optionalString(body, 'personaId', { max: 40 })
  if (!value) return null
  return TEACHER_PERSONAS.some((persona) => persona.id === value) ? value : null
}

export function parseTeacherConfig(body: Record<string, unknown>): TeacherConfig {
  return {
    name: requiredString(body, 'name', { max: 40 }),
    personality: requiredString(body, 'personality', { max: 400 }),
    humor: boundedInt(body, 'humor', { min: 0, max: 10 }),
    formality: boundedInt(body, 'formality', { min: 0, max: 10 }),
    severity: boundedInt(body, 'severity', { min: 0, max: 10 }),
    correctionStyle: requiredString(body, 'correctionStyle', { max: 400 }),
    englishLevelMode: oneOf(body, 'englishLevelMode', ['auto', 'fixed'] as const),
    spanishUsage: oneOf(body, 'spanishUsage', SPANISH_USAGE_OPTIONS),
    debateEnabled: booleanOrNull(body, 'debateEnabled'),
    character: optionalString(body, 'character', { max: 300 }) || null,
    tagline: optionalString(body, 'tagline', { max: 120 }) || null,
    maxCorrections: optionalInt(body, 'maxCorrections', { min: 1, max: 2 }),
    speechStyle: optionalString(body, 'speechStyle', { max: 400 }) || null,
    greeting: optionalString(body, 'greeting', { max: 300 }) || null,
    examples: optionalString(body, 'examples', { max: 1200 }) || null,
    neverDoes: optionalString(body, 'neverDoes', { max: 400 }) || null,
    scenarios: optionalString(body, 'scenarios', { max: 400 }) || null,
    avatar: parseAvatar(body),
    voice: optionalString(body, 'voice', { max: 120 }) || null,
    autoSpeak: booleanValue(body, 'autoSpeak', false),
    personaId: parsePersonaId(body),
  }
}
