import type {
  CefrLevel,
  LearnerError,
  Profile,
  SkillCode,
  SkillProgress,
  TeacherConfig,
} from '@english-coach/shared'
import { CEFR_LEVELS, SKILL_CODES, SKILL_NAMES, scoreLabel } from '@english-coach/shared'
import type { AIMessage } from './types'

// Los prompts viven aquí, no repartidos por las rutas. Se arman por bloques
// pequeños para no mandar la conversación completa en cada mensaje.

export interface TeacherPromptInput {
  config: TeacherConfig
  profile: Profile | null
  skills: SkillProgress[]
  errors: LearnerError[]
  conversationSummary: string | null
}

function spanishRule(usage: TeacherConfig['spanishUsage']): string {
  if (usage === 'never') return 'Never use Spanish, even if I ask for it.'
  if (usage === 'often') return 'Write mostly in English, but explain difficult points in Spanish.'
  return 'Write in English. Use a short phrase in Spanish only when I seem confused.'
}

function levelSummary(skills: SkillProgress[]): string {
  const measured = skills.filter((skill) => skill.score !== null)
  if (measured.length === 0) return 'not measured yet (start around A2)'
  return measured.map((skill) => `${SKILL_NAMES[skill.code]}: ${skill.label}`).join(', ')
}

function overallLevel(skills: SkillProgress[]): string {
  const measured = skills.filter((skill): skill is SkillProgress & { score: number } => skill.score !== null)
  if (measured.length === 0) return 'A2'
  const average = measured.reduce((total, skill) => total + skill.score, 0) / measured.length
  return scoreLabel(average)
}

export function buildTeacherSystem(input: TeacherPromptInput): string {
  const { config, profile, skills, errors } = input
  const studentName = profile?.displayName?.trim() || 'the student'
  const level = config.englishLevelMode === 'auto' ? overallLevel(skills) : 'the level I set'

  const lines: string[] = [
    `You are ${config.name}, ${studentName}'s personal English teacher. You are not a generic chatbot.`,
    `Personality: ${config.personality}`,
    `Tone: humor ${config.humor}/10 (0 = serious, 10 = playful), formality ${config.formality}/10.`,
    `Strictness about mistakes: ${config.severity}/10.`,
    `Your way of correcting: ${config.correctionStyle}`,
    `Speak English at CEFR level ${level}, and keep your vocabulary at that level.`,
    `Language: ${spanishRule(config.spanishUsage)}`,
  ]

  if (config.character) {
    lines.push(
      `You are in character: ${config.character}`,
      'Play that persona the whole time: its energy, its way of speaking, its examples and its interests.',
      'Never mention that you are an AI, that you are playing a role, or that this app exists.',
      'The teaching rules below always win: stay in character, but never break a rule to do it.',
    )
  }

  if (config.debateEnabled === true) {
    lines.push('When I give an opinion, challenge it politely and make me defend my reasons.')
  }

  lines.push(
    '',
    'Rules you always follow:',
    '- Reply in 2 to 5 short sentences unless I ask for something longer.',
    '- Correct at most 1 or 2 mistakes per reply. Skip small slips.',
    '- Prioritise mistakes listed below as "recurring" and mistakes above my level.',
    '- When you correct: show the natural version, explain why in ONE short line, then ask me to try again.',
    '- Never rewrite my whole message. Never list every error.',
    '- Stay in character and keep the conversation going with a question or a small challenge.',
    '- If I write in Spanish, keep the lesson in English but explain in Spanish if I am stuck.',
    '',
    'Machine-readable corrections: if you corrected something, end your reply with one line per',
    'correction, exactly in this format and nothing after it:',
    '[[fix: original text | corrected text | one-line reason | short topic | skill]]',
    `Where "skill" is exactly one of: ${SKILL_CODES.join(', ')}.`,
    'If you did not correct anything, do not write that line at all.',
    '',
    `My level per skill: ${levelSummary(skills)}`,
  )

  if (profile?.goals.length) {
    lines.push(`My goals: ${profile.goals.join('; ')}`)
  }
  if (profile?.correctionPreference) {
    lines.push(`How I like to be corrected: ${profile.correctionPreference}`)
  }

  if (errors.length > 0) {
    lines.push(
      '',
      'Recurring mistakes to watch for (keep them in mind, do not list them all):',
      ...errors.map(
        (error) => `- "${error.original}" → "${error.correction}" (${error.topic}, x${error.occurrences})`,
      ),
    )
  }

  return lines.join('\n')
}

export function buildTeacherMessages(
  summary: string | null,
  recent: { role: 'user' | 'assistant'; content: string }[],
): AIMessage[] {
  const messages: AIMessage[] = []
  if (summary) {
    messages.push({
      role: 'assistant',
      content: `(Summary of our previous conversation: ${summary})`,
    })
  }
  messages.push(...recent)
  return messages
}

export interface WritingScore {
  cefr: CefrLevel
  position: number
  strengths: string[]
  weaknesses: string[]
  errors: { original: string; correction: string; explanation: string; topic: string }[]
}

export function buildWritingSystem(): string {
  return [
    'You are a CEFR writing examiner for a personal English app.',
    'You receive one task and the student answer. Reply with JSON only, no prose, no markdown.',
    'Estimate the CEFR level of the answer honestly. Do not be generous: a short, simple answer is A2.',
    'JSON shape:',
    '{"cefr":"A1|A2|B1|B2|C1|C2","position":0-5,"strengths":["..."],"weaknesses":["..."],',
    '"errors":[{"original":"...","correction":"...","explanation":"...","topic":"..."}]}',
    '"position" is the same level as a number: A1=0, A2=1, B1=2, B2=3, C1=4, C2=5. Decimals are allowed.',
    'Give at most 2 strengths, at most 2 weaknesses and at most 3 errors.',
    'Write strengths/weaknesses/explanation in Spanish (short). Keep "original" and "correction" in English.',
  ].join('\n')
}

export function buildWritingUser(task: string, rubric: string, answer: string): AIMessage[] {
  return [
    {
      role: 'user',
      content: `TASK: ${task}\nRUBRIC: ${rubric}\n\nSTUDENT ANSWER:\n${answer}`,
    },
  ]
}

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, max)
    .map((item) => item.trim().slice(0, 160))
}

export function parseWritingScore(raw: string): WritingScore {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '').trim())
  } catch {
    throw new Error('El evaluador no devolvió JSON válido.')
  }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Respuesta del evaluador vacía.')

  const data = parsed as Record<string, unknown>
  const cefr = (CEFR_LEVELS as readonly string[]).includes(String(data.cefr))
    ? (String(data.cefr) as CefrLevel)
    : 'A2'
  const rawPosition = typeof data.position === 'number' ? data.position : CEFR_LEVELS.indexOf(cefr)
  const position = Math.min(5, Math.max(0, rawPosition))

  const errors = Array.isArray(data.errors)
    ? data.errors
        .slice(0, 3)
        .map((item) => item as Record<string, unknown>)
        .filter((item) => typeof item.original === 'string' && typeof item.correction === 'string')
        .map((item) => ({
          original: String(item.original).slice(0, 200),
          correction: String(item.correction).slice(0, 200),
          explanation: String(item.explanation ?? '').slice(0, 300),
          topic: String(item.topic ?? 'general').slice(0, 80),
        }))
    : []

  return {
    cefr,
    position,
    strengths: asStringArray(data.strengths, 2),
    weaknesses: asStringArray(data.weaknesses, 2),
    errors,
  }
}

export interface TeacherCorrection {
  skill: SkillCode
  topic: string
  original: string
  correction: string
  explanation: string
}

export interface ParsedTeacherReply {
  text: string
  corrections: TeacherCorrection[]
}

const FIX_PATTERN = /\[\[\s*fix:\s*([^\]]+?)\s*\]\]/gi

export function parseTeacherReply(raw: string): ParsedTeacherReply {
  const corrections: TeacherCorrection[] = []

  const text = raw
    .replace(FIX_PATTERN, (_match, payload: string) => {
      const [original, correction, explanation, topic, skill] = payload.split('|').map((part) => part.trim())
      if (original && correction) {
        corrections.push({
          original: original.slice(0, 200),
          correction: correction.slice(0, 200),
          explanation: (explanation ?? '').slice(0, 300),
          topic: (topic ?? 'general').slice(0, 80),
          skill: skillFromText(skill),
        })
      }
      return ''
    })
    .trim()

  return { text, corrections }
}

/** El modelo a veces escribe la habilidad en otro idioma; si no la reconocemos, va a gramática. */
function skillFromText(value: string | undefined): SkillCode {
  const normalized = (value ?? '').trim().toLowerCase()
  return (SKILL_CODES as readonly string[]).includes(normalized) ? (normalized as SkillCode) : 'grammar'
}

export function buildSummarySystem(): string {
  return [
    'You summarise short English tutoring conversations.',
    'Reply with at most 3 short bullet points, in Spanish, plain text, no markdown headers.',
    'Cover: what we talked about, what the student struggled with, and what to review next.',
  ].join('\n')
}

export function buildSummaryUser(transcript: string): AIMessage[] {
  return [{ role: 'user', content: `Conversation so far:\n${transcript}` }]
}
