// Contrato entre el frontend y la API. Nada aquí conoce a Cloudflare ni a React.

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

/** Etiqueta para mostrar: "B1" o "B1+" según el decimal del puntaje. */
export function scoreLabel(score: number): string {
  const clamped = Math.min(5, Math.max(0, score))
  const base = CEFR_LEVELS[Math.round(clamped)] ?? 'A1'
  return clamped - Math.round(clamped) >= 0.35 ? `${base}+` : base
}

export const SKILL_CODES = [
  'grammar',
  'vocabulary',
  'reading',
  'listening',
  'speaking',
  'writing',
  'pronunciation',
] as const
export type SkillCode = (typeof SKILL_CODES)[number]

export const SKILL_NAMES: Record<SkillCode, string> = {
  grammar: 'Gramática',
  vocabulary: 'Vocabulario',
  reading: 'Lectura',
  listening: 'Listening',
  speaking: 'Speaking',
  writing: 'Escritura',
  pronunciation: 'Pronunciación',
}

/** Habilidades que la etapa 1 todavía no puede medir. */
export const PENDING_SKILLS: SkillCode[] = ['listening', 'speaking', 'pronunciation']

export type SkillProgress = {
  code: SkillCode
  name: string
  /** null = pendiente (todavía no se puede medir). */
  score: number | null
  cefr: CefrLevel | null
  label: string | null
  mastery: number
  attempts: number
  correct: number
  lastReviewedAt: number | null
  nextReviewAt: number | null
}

// ---------------------------------------------------------------- usuario

export type Profile = {
  displayName: string
  nativeLanguage: string
  goals: string[]
  correctionPreference: string
  onboardedAt: number | null
}

export type SessionInfo = {
  authenticated: boolean
  userId: string | null
  displayName: string | null
}

// ---------------------------------------------------------------- profesor

export const SPANISH_USAGE_OPTIONS = ['never', 'when_needed', 'often'] as const
export type SpanishUsage = (typeof SPANISH_USAGE_OPTIONS)[number]

/** Cómo se llama cada opción de uso del español, en las pantallas. */
export const SPANISH_USAGE_LABELS: Record<SpanishUsage, string> = {
  never: 'Casi nunca',
  when_needed: 'Cuando hace falta',
  often: 'A menudo',
}

/** Los dibujos que trae la app. Viven en web/public/avatars/<id>.svg. */
export const AVATAR_PRESET_IDS = ['coach', 'brit', 'friend', 'mentor', 'gamer', 'detective'] as const
export type AvatarPresetId = (typeof AVATAR_PRESET_IDS)[number]

export const AVATAR_PRESET_LABELS: Record<AvatarPresetId, string> = {
  coach: 'Entrenador',
  brit: 'Profesora',
  friend: 'Amistad',
  mentor: 'Mentor',
  gamer: 'Rival',
  detective: 'Detective',
}

export function isAvatarPreset(value: string): value is AvatarPresetId {
  return (AVATAR_PRESET_IDS as readonly string[]).includes(value)
}

/** Lo que va en el `src` de un <img>. null = no hay avatar y se muestran las iniciales. */
export function avatarSrc(avatar: string | null): string | null {
  if (!avatar) return null
  if (isAvatarPreset(avatar)) return `/avatars/${avatar}.svg`
  if (avatar.startsWith('data:image/')) return avatar
  return null
}

export type TeacherConfig = {
  name: string
  personality: string
  /** 0 = serio, 10 = bromista. */
  humor: number
  /** 0 = relajado, 10 = formal. */
  formality: number
  /** 0 = suave, 10 = estricto. */
  severity: number
  correctionStyle: string
  englishLevelMode: 'auto' | 'fixed'
  spanishUsage: SpanishUsage
  /** Aún no decido: null = sin definir. */
  debateEnabled: boolean | null
  /** El personaje del profe: null = sin definir. */
  character: string | null
  /** La frase que lo resume, la que se ve en la tarjeta. */
  tagline: string | null
  /** Cuántos errores corrige por mensaje: 1, 2 o null (automático). */
  maxCorrections: number | null
  /** Cómo habla: ritmo, muletillas, jergas, exclamaciones. */
  speechStyle: string | null
  /** Cómo saluda al abrir una charla nueva. */
  greeting: string | null
  /** 3 o 4 intercambios de ejemplo que muestran su voz y cómo corrige. */
  examples: string | null
  /** Lo que nunca hace (no se burla, no traduce todo, no sale del personaje). */
  neverDoes: string | null
  /** Situaciones donde brilla: entrevista, pedir comida, una escena de su mundo. */
  scenarios: string | null
  /** Id de la galería, una imagen "data:image/…" subida por el usuario, o null. */
  avatar: string | null
  /** Nombre de la voz del sistema (speechSynthesis). null = la voz por defecto del dispositivo. */
  voice: string | null
  /** Leer en voz alta lo que responde el profesor. */
  autoSpeak: boolean
  /** Arquetipo elegido en la galería. Solo para la interfaz. */
  personaId: string | null
}

export const DEFAULT_TEACHER_CONFIG: TeacherConfig = {
  name: 'Alex',
  personality: 'Paciente, curioso y directo. Le interesa lo que hago y lo recuerda.',
  humor: 4,
  formality: 3,
  severity: 4,
  correctionStyle: 'Corrige solo lo importante o lo que repito, y me pide intentarlo de nuevo.',
  englishLevelMode: 'auto',
  spanishUsage: 'when_needed',
  debateEnabled: null,
  character: null,
  tagline: null,
  maxCorrections: null,
  speechStyle: null,
  greeting: null,
  examples: null,
  neverDoes: null,
  scenarios: null,
  avatar: null,
  voice: null,
  autoSpeak: false,
  personaId: null,
}

/**
 * Arquetipos listos para elegir. Son personajes inventados para esta app: nada
 * con dueño (ni nombres ni dibujos de franquicias). El personaje que tú quieras
 * lo escribes en el campo libre de "Mi profesor".
 */
export type TeacherPersona = {
  id: string
  /** Nombre en español para la galería. */
  label: string
  tagline: string
  /** Nombre sugerido para el profe. */
  teacherName: string
  avatar: AvatarPresetId
  /** Cómo es, en español: va directo al prompt. */
  personality: string
  /** El personaje en inglés: es el rol que el modelo interpreta. */
  character: string
  /** Cómo habla ese personaje, para rellenar la ficha de una vez. */
  speechStyle: string
  /** Cómo saluda al abrir una charla nueva. */
  greeting: string
  humor: number
  formality: number
  severity: number
  correctionStyle: string
  spanishUsage: SpanishUsage
  voiceHint: { lang: 'en-US' | 'en-GB' | 'en-AU' | null; gender: 'male' | 'female' | 'any' }
}

export const TEACHER_PERSONAS: readonly TeacherPersona[] = [
  {
    id: 'coach',
    label: 'Entrenador',
    tagline: 'Te empuja, te celebra cada avance y no te deja rendirte.',
    teacherName: 'Max',
    avatar: 'coach',
    personality:
      'Entrenador enérgico y motivador. Celebra cada avance, te empuja a dar un poco más y usa metáforas de entrenamiento.',
    character:
      'a high-energy personal trainer who treats English like a workout: short drills, small challenges and loud encouragement. He uses sports metaphors and never lets you skip practice.',
    speechStyle:
      'Frases cortas y energía alta. Usa «Let\'s go!» y «One more time!», y compara el inglés con entrenar.',
    greeting: 'Hey! Warm-up time. Tell me one thing you did today.',
    humor: 6,
    formality: 2,
    severity: 5,
    correctionStyle: 'Corrige en el momento y con energía, y te hace repetir la frase bien una vez.',
    spanishUsage: 'when_needed',
    voiceHint: { lang: 'en-US', gender: 'male' },
  },
  {
    id: 'brit',
    label: 'Profesora',
    tagline: 'Formal, precisa y con un humor seco muy británico.',
    teacherName: 'Eleanor',
    avatar: 'brit',
    personality:
      'Profesora formal y precisa. Le importa la cortesía, la palabra exacta y la pronunciación, con un humor seco y sutil.',
    character:
      'a formal British teacher with precise pronunciation and dry, subtle wit. She cares about politeness, exact word choice and getting the sounds right.',
    speechStyle:
      'Pausada y precisa. Evita las contracciones cuando corrige y usa un humor seco: un «quite» dice más que un discurso.',
    greeting: 'Good evening. Shall we begin with something you did today?',
    humor: 4,
    formality: 9,
    severity: 7,
    correctionStyle: 'Corrige con precisión: da la versión natural y explica en una línea por qué suena mejor.',
    spanishUsage: 'never',
    voiceHint: { lang: 'en-GB', gender: 'female' },
  },
  {
    id: 'friend',
    label: 'Amistad',
    tagline: 'Relajado, habla de la vida y del día a día contigo.',
    teacherName: 'Sam',
    avatar: 'friend',
    personality:
      'Amistad relajada y cercana. Habla de la vida diaria, series, música y planes, sin solemnidad.',
    character:
      'a relaxed friend your age who chats about daily life, music, series and weekend plans. Casual, warm and informal, with everyday vocabulary.',
    speechStyle: 'Coloquial y rápido: «Hey», «yeah», «no way». Habla de planes y series como en un chat de amigos.',
    greeting: 'Hey! How was your day? Tell me the small stuff.',
    humor: 7,
    formality: 1,
    severity: 3,
    correctionStyle: 'Corrige solo lo que suena raro, como quien repite la frase bien sin dar clase.',
    spanishUsage: 'when_needed',
    voiceHint: { lang: 'en-US', gender: 'any' },
  },
  {
    id: 'mentor',
    label: 'Mentor',
    tagline: 'Tranquilo y paciente: te hace razonar antes de darte la respuesta.',
    teacherName: 'Rune',
    avatar: 'mentor',
    personality:
      'Mentor tranquilo y paciente. Prefiere hacerte razonar con preguntas antes que darte la respuesta.',
    character:
      'a calm, patient mentor who asks questions to make you think before giving the answer, and explains the why behind every rule.',
    speechStyle: 'Tono tranquilo y ritmo lento. Pregunta más de lo que afirma y deja silencios para que pienses.',
    greeting: 'Let us take it easy today. What would you like to understand better?',
    humor: 3,
    formality: 6,
    severity: 4,
    correctionStyle: 'Corrige explicando el porqué y te pide que lo apliques en otra frase tuya.',
    spanishUsage: 'when_needed',
    voiceHint: { lang: 'en-US', gender: 'male' },
  },
  {
    id: 'gamer',
    label: 'Rival',
    tagline: 'Competitivo: convierte cada charla en un reto con marcador.',
    teacherName: 'Nova',
    avatar: 'gamer',
    personality:
      'Rival competitiva y juguetona. Convierte la práctica en un reto con puntos, y se burla un poco cuando fallas.',
    character:
      'a competitive, playful rival who turns every lesson into a game with points, streaks and rematches. She teases you a little when you slip, then pushes you to beat your score.',
    speechStyle: 'Rápida y pícara, con vocabulario de juego: puntos, rachas y revancha. Te reta en cada respuesta.',
    greeting: 'Rematch time. Warm up: tell me one thing you did today.',
    humor: 7,
    formality: 1,
    severity: 6,
    correctionStyle: 'Te para en seco cuando fallas, te da la forma correcta y te reta a repetirla sin fallar.',
    spanishUsage: 'when_needed',
    voiceHint: { lang: 'en-US', gender: 'female' },
  },
  {
    id: 'detective',
    label: 'Detective',
    tagline: 'Te interroga con calma: quiere detalles y pruebas de todo.',
    teacherName: 'Marlow',
    avatar: 'detective',
    personality:
      'Detective meticuloso. Te interroga con calma y quiere detalles concretos de todo lo que cuentas.',
    character:
      'a sharp, methodical detective who investigates every story you tell: she asks for details, evidence and exact descriptions, and treats English as the tool for saying precisely what happened.',
    speechStyle: 'Tono de informe: frases ordenadas, repite lo que dijiste y pide el detalle que faltó.',
    greeting: 'Let me take your statement. What did you do today?',
    humor: 4,
    formality: 6,
    severity: 4,
    correctionStyle: 'Repite tu frase como un informe y te pide la versión exacta con el detalle que faltó.',
    spanishUsage: 'never',
    voiceHint: { lang: 'en-GB', gender: 'female' },
  },
]

/**
 * Rellena una ficha nueva con lo que trae un arquetipo de la galería. Lo usan
 * el navegador (al elegir en la galería) y el servidor (al estrenar biblioteca),
 * así no se puede quedar uno distinto del otro.
 */
export function configFromPersona(persona: TeacherPersona): TeacherConfig {
  return {
    ...DEFAULT_TEACHER_CONFIG,
    name: persona.teacherName,
    personality: persona.personality,
    humor: persona.humor,
    formality: persona.formality,
    severity: persona.severity,
    correctionStyle: persona.correctionStyle,
    spanishUsage: persona.spanishUsage,
    character: persona.character,
    tagline: persona.tagline,
    speechStyle: persona.speechStyle,
    greeting: persona.greeting,
    avatar: persona.avatar,
    personaId: persona.id,
  }
}

// ---------------------------------------------------------------- personajes

/** Un personaje recién creado y todavía sin abrir se marca como novedad. */
export const CHARACTER_NEW_DAYS = 7

/** La frase de la tarjeta: la que escribiste o, si no hay, cómo es el personaje. */
export function characterTagline(config: TeacherConfig): string {
  const text = config.tagline?.trim() || config.personality.trim()
  return text.slice(0, 120)
}

export type CharacterCard = {
  id: string
  name: string
  tagline: string
  avatar: string | null
  favorite: boolean
  /** Mensajes que escribiste tú a este personaje. */
  messageCount: number
  lastUsedAt: number | null
  createdAt: number
  /** Creado hace poco y todavía sin abrir: es la novedad sin ver. */
  isNew: boolean
}

/** La tarjeta y, además, la ficha completa: lo que abre la pantalla del personaje. */
export type CharacterDetail = CharacterCard & { config: TeacherConfig }

// ---------------------------------------------------------------- test

export type QuestionType = 'mcq' | 'short' | 'writing'

/** Lo que ve el navegador. Nunca incluye la respuesta correcta. */
export type AssessmentQuestion = {
  id: string
  skill: SkillCode
  cefr: CefrLevel
  type: QuestionType
  instructions: string
  prompt: string
  passage: { title: string; text: string } | null
  options: string[] | null
  number: number
  total: number
}

export type LearnerError = {
  id: string
  skill: SkillCode
  topic: string
  original: string
  correction: string
  explanation: string
  occurrences: number
  lastSeenAt: number
}

export type AssessmentResult = {
  attemptId: string
  finishedAt: number
  skills: SkillProgress[]
  strengths: string[]
  weaknesses: string[]
  pending: SkillCode[]
  errors: LearnerError[]
}

export type AssessmentAnswerResponse =
  | { done: false; question: AssessmentQuestion; answered: number; total: number }
  | { done: true; result: AssessmentResult }

/** Lo que devuelve /api/assessment/start. */
export type AssessmentStartResponse = {
  attemptId: string
  question: AssessmentQuestion
  answered: number
  total: number
}

// ---------------------------------------------------------------- chat

export type Conversation = {
  id: string
  title: string
  summary: string | null
  lastMessageAt: number | null
  /** El personaje de la charla. `null` en las charlas viejas, sin personaje. */
  characterId: string | null
}

/** Lo que devuelve abrir la charla de un personaje: todo en una sola llamada. */
export type CharacterChat = {
  character: CharacterDetail
  conversation: Conversation
  messages: ChatMessage[]
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  corrections: LearnerError[]
}

export type SendMessageResponse = {
  userMessage: ChatMessage
  reply: ChatMessage
}

// ---------------------------------------------------------------- inicio

export type HomeTask = {
  kind: 'profile' | 'assessment' | 'chat' | 'review'
  title: string
  description: string
  href: string
}

export type HomeData = {
  hasProfile: boolean
  hasAssessment: boolean
  task: HomeTask
  skills: SkillProgress[]
  lastAssessmentAt: number | null
  teacher: TeacherConfig
  topErrors: LearnerError[]
}

// ---------------------------------------------------------------- archivos

/** Qué le pedimos al modelo con el archivo que subes. */
export type UploadMode = 'transcribe' | 'translate'

export const UPLOAD_MODE_LABELS: Record<UploadMode, string> = {
  transcribe: 'Transcribir',
  translate: 'Transcribir y traducir',
}

/** Lo que el modelo saca del archivo. */
export type UploadResult = {
  title: string
  transcript: string
  /** `null` cuando solo pediste transcribir o cuando ya estaba en español. */
  translation: string | null
  /** Frases o detalles del archivo que vale la pena mirar con calma. */
  notes: string[]
}

export type UploadRecord = {
  id: string
  fileName: string
  mimeType: string
  size: number
  mode: UploadMode
  result: UploadResult
  createdAt: number
}

// ---------------------------------------------------------------- API

export type ApiErrorBody = { error: string; message: string }
