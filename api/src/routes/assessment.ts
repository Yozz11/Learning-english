import type { AssessmentAnswerResponse, AssessmentResult, SkillCode } from '@english-coach/shared'
import { PENDING_SKILLS, SKILL_CODES } from '@english-coach/shared'
import { buildWritingSystem, buildWritingUser, parseWritingScore } from '../ai/prompts'
import { getProvider } from '../ai/registry'
import {
  MAX_QUESTIONS,
  SECTION_KEYS,
  buildMeasurements,
  describeStrengthsAndWeaknesses,
  indexQuestions,
  pickNextQuestion,
  toQuestionDto,
} from '../assessment/engine'
import {
  createAttempt,
  finishAttempt,
  getAttempt,
  getLatestFinishedAttempt,
  getUserSkills,
  insertAnswer,
  listActiveQuestions,
  listAnswers,
  listTopErrors,
  saveUserSkills,
  upsertLearnerError,
  type AnswerRow,
  type QuestionRow,
  type UserSkillWrite,
} from '../db/queries'
import type { Env } from '../env'
import { ApiError, json, readJsonBody } from '../lib/http'
import type { RouteHandler } from '../lib/router'
import { requiredString } from '../lib/validate'

interface Grading {
  isCorrect: boolean | null
  score: number | null
  cefr: string | null
  feedback: string | null
  errors: { skill: SkillCode; topic: string; original: string; correction: string; explanation: string }[]
}

/** Respuestas de opción múltiple: se corrigen con la clave guardada en la base. */
function gradeChoice(question: QuestionRow, answer: string): Grading {
  let expected: number | null = null
  if (question.answer_key) {
    try {
      const parsed = JSON.parse(question.answer_key) as { index?: unknown }
      if (typeof parsed.index === 'number') expected = parsed.index
    } catch {
      expected = null
    }
  }
  if (expected === null) {
    throw new ApiError(500, 'question_without_key', 'Esa pregunta no tiene respuesta guardada.')
  }
  const isCorrect = Number(answer.trim()) === expected
  return { isCorrect, score: null, cefr: null, feedback: null, errors: [] }
}

/** Escritura: la evalúa la IA con una rúbrica y devuelve nivel + errores. */
async function gradeWriting(env: Env, question: QuestionRow, answer: string): Promise<Grading> {
  const provider = getProvider(env)
  const result = await provider.chat({
    tag: 'writing',
    system: buildWritingSystem(),
    messages: buildWritingUser(question.prompt, question.rubric ?? '', answer),
    temperature: 0.2,
    maxTokens: 700,
    json: true,
  })

  let score
  try {
    score = parseWritingScore(result.text)
  } catch {
    throw new ApiError(502, 'writing_parse_failed', 'No pude evaluar ese texto. Intenta enviarlo otra vez.')
  }

  return {
    isCorrect: null,
    score: score.position,
    cefr: score.cefr,
    feedback: JSON.stringify({ strengths: score.strengths, weaknesses: score.weaknesses, model: result.model }),
    errors: score.errors.map((error) => ({
      skill: question.skill_id as SkillCode,
      topic: error.topic,
      original: error.original,
      correction: error.correction,
      explanation: error.explanation,
    })),
  }
}

function collectWritingFeedback(answers: AnswerRow[]): { strengths: string[]; weaknesses: string[] } {
  const strengths: string[] = []
  const weaknesses: string[] = []

  for (const answer of answers) {
    if (!answer.feedback) continue
    try {
      const parsed = JSON.parse(answer.feedback) as { strengths?: unknown; weaknesses?: unknown }
      if (Array.isArray(parsed.strengths)) strengths.push(...parsed.strengths.map(String))
      if (Array.isArray(parsed.weaknesses)) weaknesses.push(...parsed.weaknesses.map(String))
    } catch {
      // Si el feedback quedó ilegible, no es motivo para romper el resultado.
    }
  }

  return { strengths: strengths.slice(0, 2), weaknesses: weaknesses.slice(0, 2) }
}

async function finalizeAttempt(
  env: Env,
  userId: string,
  attemptId: string,
  answers: AnswerRow[],
  byId: Map<string, QuestionRow>,
): Promise<AssessmentResult> {
  const measurements = buildMeasurements(answers, byId)
  const described = describeStrengthsAndWeaknesses(measurements)

  const writes: UserSkillWrite[] = SKILL_CODES.map((code) => {
    const measurement = measurements.find((item) => item.skill === code)
    if (!measurement) {
      return { code, score: null, cefr: null, mastery: 0, attempts: 0, correct: 0 }
    }
    return {
      code,
      score: measurement.score,
      cefr: measurement.label,
      mastery: measurement.mastery,
      attempts: measurement.attempts,
      correct: measurement.correct,
    }
  })
  await saveUserSkills(env.DB, userId, writes)

  const writingFeedback = collectWritingFeedback(answers)
  const errors = await listTopErrors(env.DB, userId, 10)

  const result: AssessmentResult = {
    attemptId,
    finishedAt: Date.now(),
    skills: await getUserSkills(env.DB, userId),
    strengths: [...writingFeedback.strengths, ...described.strengths].slice(0, 4),
    weaknesses: [...writingFeedback.weaknesses, ...described.weaknesses].slice(0, 4),
    pending: PENDING_SKILLS,
    errors,
  }

  const provider = getProvider(env)
  await finishAttempt(env.DB, attemptId, result, provider.id, env.GEMINI_MODEL ?? 'mock')
  return result
}

export const startAssessment: RouteHandler = async ({ env, userId }) => {
  const questions = await listActiveQuestions(env.DB, SECTION_KEYS)
  const byId = indexQuestions(questions)
  const first = pickNextQuestion(questions, [], byId)
  if (!first) {
    throw new ApiError(500, 'no_questions', 'No hay preguntas cargadas. Corre las migraciones de la base.')
  }

  const attemptId = await createAttempt(env.DB, userId)
  const response: AssessmentAnswerResponse = {
    done: false,
    question: toQuestionDto(first, 1, MAX_QUESTIONS),
    answered: 0,
    total: MAX_QUESTIONS,
  }
  return json({ attemptId, ...response })
}

export const answerAssessment: RouteHandler = async ({ req, env, userId }) => {
  const body = await readJsonBody(req)
  const attemptId = requiredString(body, 'attemptId', { max: 80 })
  const questionId = requiredString(body, 'questionId', { max: 80 })
  const answer = requiredString(body, 'answer', { max: 4000 })

  const attempt = await getAttempt(env.DB, attemptId)
  if (!attempt || attempt.user_id !== userId) {
    throw new ApiError(404, 'attempt_not_found', 'No encuentro ese test.')
  }
  if (attempt.status !== 'in_progress') {
    throw new ApiError(409, 'attempt_finished', 'Ese test ya terminó.')
  }

  const questions = await listActiveQuestions(env.DB, SECTION_KEYS)
  const byId = indexQuestions(questions)
  const answers = await listAnswers(env.DB, attemptId)

  // El servidor decide qué pregunta toca: no confía en lo que manda el navegador.
  const expected = pickNextQuestion(questions, answers, byId)
  if (!expected || expected.id !== questionId) {
    throw new ApiError(409, 'out_of_order', 'Esa pregunta ya no toca. Recarga el test.')
  }

  const grading =
    expected.type === 'writing'
      ? await gradeWriting(env, expected, answer)
      : gradeChoice(expected, answer)

  await insertAnswer(env.DB, {
    attemptId,
    questionId: expected.id,
    answer,
    isCorrect: grading.isCorrect,
    score: grading.score,
    cefr: grading.cefr,
    feedback: grading.feedback,
  })

  for (const error of grading.errors) {
    await upsertLearnerError(env.DB, { userId, ...error })
  }

  const updatedAnswers = await listAnswers(env.DB, attemptId)
  const next = pickNextQuestion(questions, updatedAnswers, byId)

  if (next) {
    const response: AssessmentAnswerResponse = {
      done: false,
      question: toQuestionDto(next, updatedAnswers.length + 1, MAX_QUESTIONS),
      answered: updatedAnswers.length,
      total: MAX_QUESTIONS,
    }
    return json(response)
  }

  const result = await finalizeAttempt(env, userId, attemptId, updatedAnswers, byId)
  return json({ done: true, result } satisfies AssessmentAnswerResponse)
}

export const latestAssessment: RouteHandler = async ({ env, userId }) => {
  const attempt = await getLatestFinishedAttempt(env.DB, userId)
  if (!attempt?.result) return json(null)
  try {
    return json(JSON.parse(attempt.result) as AssessmentResult)
  } catch {
    return json(null)
  }
}
