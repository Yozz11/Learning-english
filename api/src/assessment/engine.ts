import type { AssessmentQuestion, CefrLevel, QuestionType, SkillCode } from '@english-coach/shared'
import { scoreLabel } from '@english-coach/shared'
import type { AnswerRow, QuestionRow } from '../db/queries'

// Motor del test: reglas simples, sin modelo y sin magia.
//
// Idea: en cada parte empiezo en B1 y busco el borde entre lo que sé y lo que no.
// Si acierto, subo; si fallo, bajo. Cuando ya no quedan preguntas en la zona
// dudosa (entre la última que acerté y la primera que fallé), dejo de preguntar.
// Así el test es más corto y el resultado no se ensucia por preguntar de más.

export interface Section {
  key: string
  skill: SkillCode
  /** Preguntas mínimas antes de poder cerrar la parte. */
  min: number
  /** Tope de preguntas de la parte. */
  max: number
  label: string
}

export const SECTIONS: Section[] = [
  { key: 'grammar', skill: 'grammar', min: 3, max: 6, label: 'Gramática' },
  { key: 'vocabulary', skill: 'vocabulary', min: 3, max: 6, label: 'Vocabulario' },
  { key: 'reading', skill: 'reading', min: 3, max: 6, label: 'Lectura' },
  { key: 'writing', skill: 'writing', min: 2, max: 2, label: 'Escritura' },
]

export const SECTION_KEYS = SECTIONS.map((section) => section.key)
/** Máximo de preguntas del test completo. Normalmente son menos. */
export const MAX_QUESTIONS = SECTIONS.reduce((total, section) => total + section.max, 0)

/** Dónde arranca la búsqueda: B1. */
const ANCHOR_POSITION = 2

export function indexQuestions(questions: QuestionRow[]): Map<string, QuestionRow> {
  return new Map(questions.map((question) => [question.id, question]))
}

function clamp(value: number, min = 0, max = 5): number {
  return Math.min(max, Math.max(min, value))
}

function average(values: number[]): number {
  if (values.length === 0) return ANCHOR_POSITION
  return values.reduce((total, value) => total + value, 0) / values.length
}

interface Entry {
  question: QuestionRow
  answer: AnswerRow
}

interface Summary {
  answered: number
  /** Posición más alta que acerté. null = no acerté ninguna. */
  bestCorrect: number | null
  /** Posición más baja que fallé. null = no fallé ninguna. */
  worstWrong: number | null
  /** Puntajes de la IA (solo escritura). */
  scores: number[]
}

function entriesForSection(
  section: Section,
  answers: AnswerRow[],
  byId: Map<string, QuestionRow>,
): Entry[] {
  return answers
    .map((answer) => ({ answer, question: byId.get(answer.question_id) }))
    .filter((entry): entry is Entry => entry.question?.section === section.key)
}

/** En escritura manda el puntaje de la IA; en el resto, la clave guardada. */
function isGoodAnswer(question: QuestionRow, answer: AnswerRow): boolean {
  if (answer.is_correct !== null) return answer.is_correct === 1
  return answer.score !== null && answer.score >= question.position
}

function summarize(entries: Entry[]): Summary {
  const correct = entries.filter((entry) => isGoodAnswer(entry.question, entry.answer))
  const wrong = entries.filter((entry) => !isGoodAnswer(entry.question, entry.answer))

  return {
    answered: entries.length,
    bestCorrect: correct.length > 0 ? Math.max(...correct.map((entry) => entry.question.position)) : null,
    worstWrong: wrong.length > 0 ? Math.min(...wrong.map((entry) => entry.question.position)) : null,
    scores: entries
      .map((entry) => entry.answer.score)
      .filter((value): value is number => value !== null),
  }
}

/** Punto medio de la zona dudosa: ahí es donde conviene preguntar. */
function targetPosition(summary: Summary, fallback: number): number {
  if (summary.bestCorrect === null && summary.worstWrong === null) return fallback
  if (summary.bestCorrect === null) return Math.max(0, (summary.worstWrong as number) - 1)
  if (summary.worstWrong === null) return Math.min(5, summary.bestCorrect + 1)
  return (summary.bestCorrect + summary.worstWrong) / 2
}

function nearestByPosition(pool: QuestionRow[], target: number): QuestionRow | undefined {
  return [...pool].sort((a, b) => {
    const distance = Math.abs(a.position - target) - Math.abs(b.position - target)
    if (distance !== 0) return distance
    return a.position - b.position
  })[0]
}

function pickReadingQuestion(
  pool: QuestionRow[],
  usedPassages: Set<string>,
  target: number,
): QuestionRow | undefined {
  // Primero terminamos el texto que quedó a medias.
  const inProgress = pool.filter((question) => question.passage_id && usedPassages.has(question.passage_id))
  if (inProgress.length > 0) {
    return [...inProgress].sort((a, b) => a.sort_order - b.sort_order)[0]
  }

  // Después elegimos el texto nuevo más cercano al punto que quiero medir.
  const byPassage = new Map<string, QuestionRow[]>()
  for (const question of pool) {
    if (!question.passage_id) continue
    const group = byPassage.get(question.passage_id)
    if (group) group.push(question)
    else byPassage.set(question.passage_id, [question])
  }

  const candidates = [...byPassage.values()].sort((a, b) => {
    const positionA = Math.min(...a.map((question) => question.position))
    const positionB = Math.min(...b.map((question) => question.position))
    return Math.abs(positionA - target) - Math.abs(positionB - target)
  })

  const chosen = candidates[0]
  if (!chosen) return undefined
  return [...chosen].sort((a, b) => a.sort_order - b.sort_order)[0]
}

/** Devuelve la siguiente pregunta del test, o null si ya terminó. */
export function pickNextQuestion(
  questions: QuestionRow[],
  answers: AnswerRow[],
  byId: Map<string, QuestionRow>,
): QuestionRow | null {
  const answeredIds = new Set(answers.map((answer) => answer.question_id))
  const usedPassages = new Set(
    answers
      .map((answer) => byId.get(answer.question_id)?.passage_id)
      .filter((value): value is string => typeof value === 'string'),
  )

  // Para escritura empiezo ya sabiendo cómo le va en lo demás.
  const measured = buildMeasurements(answers, byId)
  const overallAnchor = measured.length > 0 ? average(measured.map((item) => item.score)) : ANCHOR_POSITION

  for (const section of SECTIONS) {
    const entries = entriesForSection(section, answers, byId)
    if (entries.length >= section.max) continue

    const pool = questions.filter(
      (question) => question.section === section.key && !answeredIds.has(question.id),
    )
    if (pool.length === 0) continue

    const summary = summarize(entries)

    if (section.key === 'writing') {
      const target = summary.scores.length > 0 ? average(summary.scores) : overallAnchor
      const chosen = nearestByPosition(pool, target)
      if (chosen) return chosen
      continue
    }

    // La zona dudosa: por encima de lo que ya acerté y por debajo de lo que ya fallé.
    const bandLow = summary.bestCorrect === null ? -1 : summary.bestCorrect
    const bandHigh = summary.worstWrong === null ? 99 : summary.worstWrong
    const inBand = pool.filter(
      (question) => question.position > bandLow && question.position < bandHigh,
    )

    // Ya sé lo suficiente: no tiene sentido gastar más preguntas.
    if (entries.length >= section.min && inBand.length === 0) continue

    const target = targetPosition(summary, ANCHOR_POSITION)
    const usable = inBand.length > 0 ? inBand : pool
    const chosen =
      section.key === 'reading'
        ? pickReadingQuestion(usable, usedPassages, target)
        : nearestByPosition(usable, target)
    if (chosen) return chosen
  }

  return null
}

export function toQuestionDto(
  question: QuestionRow,
  number: number,
  total: number,
): AssessmentQuestion {
  let options: string[] | null = null
  if (question.options) {
    try {
      const parsed: unknown = JSON.parse(question.options)
      if (Array.isArray(parsed)) options = parsed.map((item) => String(item))
    } catch {
      options = null
    }
  }

  return {
    id: question.id,
    skill: question.skill_id as SkillCode,
    cefr: question.cefr as CefrLevel,
    type: question.type as QuestionType,
    instructions: question.instructions,
    prompt: question.prompt,
    passage: question.passage_text
      ? { title: question.passage_title ?? 'Texto', text: question.passage_text }
      : null,
    options,
    number,
    total,
  }
}

/**
 * Puntaje a partir del borde: entre la última que acerté y la primera que fallé
 * está mi nivel. Si acerté todo, subo medio nivel; si no acerté nada, bajo medio.
 */
function scoreFromBoundary(summary: Summary): number {
  if (summary.bestCorrect === null && summary.worstWrong === null) return ANCHOR_POSITION
  if (summary.bestCorrect === null) return clamp((summary.worstWrong as number) - 0.45)
  if (summary.worstWrong === null) return clamp(summary.bestCorrect + 0.9)

  const gap = summary.worstWrong - summary.bestCorrect
  // Si fallé justo en el nivel siguiente, quedo al borde de subir.
  return clamp(summary.bestCorrect + (gap <= 1 ? 0.45 : 0.15))
}

export interface SkillMeasurement {
  skill: SkillCode
  score: number
  label: string
  attempts: number
  correct: number
  mastery: number
}

/** Traduce las respuestas guardadas a un puntaje por habilidad. */
export function buildMeasurements(
  answers: AnswerRow[],
  byId: Map<string, QuestionRow>,
): SkillMeasurement[] {
  const measurements: SkillMeasurement[] = []

  for (const section of SECTIONS) {
    const entries = entriesForSection(section, answers, byId)
    if (entries.length === 0) continue

    const summary = summarize(entries)
    const score =
      section.key === 'writing' && summary.scores.length > 0
        ? clamp(average(summary.scores))
        : scoreFromBoundary(summary)
    const correct = entries.filter((entry) => isGoodAnswer(entry.question, entry.answer)).length

    measurements.push({
      skill: section.skill,
      score,
      label: scoreLabel(score),
      attempts: entries.length,
      correct,
      mastery: correct / entries.length,
    })
  }

  return measurements
}

/** Compara habilidades para decir fortalezas y debilidades. */
export function describeStrengthsAndWeaknesses(
  measurements: SkillMeasurement[],
): { strengths: string[]; weaknesses: string[] } {
  if (measurements.length === 0) return { strengths: [], weaknesses: [] }

  const sorted = [...measurements].sort((a, b) => b.score - a.score)
  const best = sorted[0] as SkillMeasurement
  const worst = sorted[sorted.length - 1] as SkillMeasurement
  const sectionLabel = (skill: SkillCode) =>
    SECTIONS.find((section) => section.skill === skill)?.label ?? skill

  const strengths = [`${sectionLabel(best.skill)}: tu punto más fuerte (${best.label}).`]
  const weaknesses =
    sorted.length > 1
      ? [`${sectionLabel(worst.skill)}: aquí hay más que ganar (${worst.label}).`]
      : []

  return { strengths, weaknesses }
}
