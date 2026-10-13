import type {
  CefrLevel,
  LearnerError,
  Profile,
  SkillCode,
  SkillProgress,
  TeacherConfig,
  UploadMode,
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
  /** 'chat' conversa como una persona; 'train' hace práctica y ejercicios. */
  mode?: 'chat' | 'train'
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

/**
 * Cuántos errores corrige por respuesta. Si la ficha no fija un máximo, la
 * severidad decide solo eso (cuántos marca), nunca el tono de la charla.
 */
function correctionLimit(config: TeacherConfig): string {
  const max = config.maxCorrections ?? (config.severity >= 6 ? 2 : 1)
  if (max === 1) {
    return 'Correct at most 1 mistake per reply: the most important one. Skip small slips.'
  }
  if (max === 2) {
    return 'Correct up to 2 mistakes per reply, never more. Skip small slips.'
  }
  return 'Correct at most 1 or 2 mistakes per reply. Skip small slips.'
}

function overallLevel(skills: SkillProgress[]): string {
  const measured = skills.filter((skill): skill is SkillProgress & { score: number } => skill.score !== null)
  if (measured.length === 0) return 'A2'
  const average = measured.reduce((total, skill) => total + skill.score, 0) / measured.length
  return scoreLabel(average)
}

export function buildTeacherSystem(input: TeacherPromptInput): string {
  const { config, profile, skills, errors, mode = 'chat' } = input
  const studentName = profile?.displayName?.trim() || 'the student'
  const level = config.englishLevelMode === 'auto' ? overallLevel(skills) : 'the level I set'
  const identity = config.character?.trim() || config.tagline?.trim() || config.personality

  const lines: string[] = [
    `You are ${config.name}. ${identity}. You are speaking with ${studentName} (this is a ${mode === 'train' ? 'training session' : 'casual chat'}).`,
    `Personality: ${config.personality}`,
    `Tone: humor ${config.humor}/10 (0 = serious, 10 = playful), formality ${config.formality}/10.`,
    `Speak English at CEFR level ${level}: keep your vocabulary at that level, but never sound like a textbook.`,
    '',
  ]

  if (mode === 'train') {
    lines.push(
      'Training rules:',
      '- Run this as a practice session: give ONE short exercise at a time (a sentence to translate, a gap to fill, a question to answer, something to say about a picture or a topic).',
      '- Pick exercises for the level above, using my recurring mistakes and my goals when they fit.',
      `- Wait for my answer before the next exercise. ${mode === 'train' ? 'Never' : 'Never'} dump a list of exercises.`,
      '- First react to what I wrote (in your voice), then correct it in one short line if it had a real mistake, then give the next exercise.',
      '- Keep being the character: the exercises must sound like you, not like a textbook.',
      '- If I ask to just chat, switch back to conversation and follow the conversation rules.',
      '- Do not mark every small slip: only what matters for the exercise.',
    )
  } else {
    lines.push(
      'Conversation rules:',
      '- React to what the student just said before anything else: answer and add something of your own (an opinion, an anecdote, a joke), the way a person would.',
      '- Length is natural: sometimes one sentence, sometimes four. No fixed formula, never a list.',
      '- Ask a question only when it comes up naturally, not in every message.',
      '- Never give lists, exercises or "now repeat after me" unless the student asks for them.',
      '- If the student changes the subject, go with them.',
    )
  }

  lines.push(`Language: ${spanishRule(config.spanishUsage)}`)

  // Ficha del personaje: lo que el usuario escribe sobre cómo es y cómo habla.
  if (config.tagline) lines.push(`In one line, you are: ${config.tagline}`)
  if (config.speechStyle) lines.push(`How you talk: ${config.speechStyle}`)
  if (config.neverDoes) lines.push(`Things you never do: ${config.neverDoes}`)
  if (config.scenarios) lines.push(`Topics you can bring up now and then, never as obligations: ${config.scenarios}`)

  if (config.character) {
    lines.push(
      'Stay in that persona the whole time: its energy, its way of speaking, its examples and its interests.',
      'When it fits, open with one very short action of the character between asterisks, like *arches an eyebrow* — not in every message.',
      'Never mention that you are an AI, that you are playing a role, or that this app exists.',
    )
  }

  if (config.examples) {
    lines.push(
      'Examples of how you talk and how you correct (copy the voice, not the exact words):',
      config.examples,
    )
  }

  if (config.debateEnabled === true) {
    lines.push('When I give an opinion, challenge it politely and make me defend my reasons.')
  }

  lines.push(
    '',
    'Correction rules (learning happens quietly, in the background):',
    `- ${correctionLimit(config)} Severity in my profile only sets HOW MANY mistakes you mark, never your tone: keep being the character.`,
    '- When you mark one: repeat the phrase correctly inside your own answer, naturally and in your voice, without stopping the chat. Only mark what matters: never interrupt a story for a small slip.',
    '- If the message is correct, correct nothing.',
    '- Never rewrite my whole message. Never list every error. Prioritise the recurring mistakes listed below and mistakes above my level.',
    '- The machine-readable line below is how the app shows the correction as a note: it is not part of the conversation.',
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

// ------------------------------------------------------- archivos subidos

/**
 * Lo que le pedimos al modelo con un archivo: transcribirlo y, si el modo lo
 * pide, traducirlo al español. Devuelve JSON para no depender de cómo maqueta.
 */
export function buildUploadSystem(mode: UploadMode): string {
  const lines = [
    'You help a Spanish-speaking student who is learning English with files they upload.',
    'The file may be an audio recording, a PDF or an image. Read it and work only with what is really there.',
    'Answer with JSON only, using exactly these keys:',
    '{"title": string, "transcript": string, "translation": string|null, "notes": string[]}',
    '- "title": a short title in Spanish for the file (max 70 characters).',
    '- "transcript": the full text of what is said or written, in its original language, without translating it.',
    '  Keep the original line breaks and paragraphs. Do not add commentary.',
  ]

  if (mode === 'translate') {
    lines.push(
      '- "translation": the whole transcript translated into natural Spanish. Same paragraphs as the transcript.',
    )
  } else {
    lines.push('- "translation": null, always.')
  }

  lines.push(
    '- "notes": up to 5 short items in Spanish with what is worth studying: tricky words, idioms or ' +
      'pronunciation details that appear in the file. Empty list if there is nothing to point out.',
    'If the file cannot be read or has no understandable audio or text, say so in "transcript" and leave the rest empty.',
  )

  return lines.join('\n')
}

export function buildUploadUser(input: {
  fileName: string
  mimeType: string
  mode: UploadMode
  text: string | null
}): AIMessage[] {
  const task =
    input.mode === 'translate'
      ? 'Task: transcribe the file and translate it into Spanish.'
      : 'Task: transcribe the file only, no translation.'

  const header = `File name: ${input.fileName}\nMime type: ${input.mimeType}\n${task}`

  // El texto plano no se manda como archivo: va dentro del propio mensaje.
  if (input.text !== null) {
    return [{ role: 'user', content: `${header}\n\nFile content:\n${input.text}` }]
  }

  return [{ role: 'user', content: `${header}\n\nThe file goes attached.` }]
}

export function buildSummaryUser(transcript: string): AIMessage[] {
  return [{ role: 'user', content: `Conversation so far:\n${transcript}` }]
}
