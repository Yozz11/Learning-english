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

export type SkillTopic = {
  id: string
  parent: SkillCode
  code: string
  name: string
  cefr: CefrLevel | null
  attempts: number
  correct: number
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
  /** Aún no decido el personaje: null = sin definir. */
  character: string | null
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
}

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

// ---------------------------------------------------------------- API

export type ApiErrorBody = { error: string; message: string }
