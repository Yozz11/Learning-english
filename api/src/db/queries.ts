import type {
  CefrLevel,
  CharacterCard,
  CharacterDetail,
  ChatMessage,
  Conversation,
  LearnerError,
  Profile,
  SkillCode,
  SkillProgress,
  TeacherConfig,
} from '@english-coach/shared'
import {
  CHARACTER_NEW_DAYS,
  DEFAULT_TEACHER_CONFIG,
  SKILL_CODES,
  SKILL_NAMES,
  TEACHER_PERSONAS,
  characterTagline,
  configFromPersona,
} from '@english-coach/shared'

// Todas las consultas están aquí, con parámetros (`?`), nunca texto armado a mano.

export interface QuestionRow {
  id: string
  skill_id: string
  section: string
  cefr: string
  position: number
  sort_order: number
  type: string
  passage_id: string | null
  passage_title: string | null
  passage_text: string | null
  instructions: string
  prompt: string
  options: string | null
  answer_key: string | null
  rubric: string | null
}

export interface AttemptRow {
  id: string
  user_id: string
  status: string
  started_at: number
  finished_at: number | null
  result: string | null
  provider: string | null
  model: string | null
}

export interface AnswerRow {
  id: string
  attempt_id: string
  question_id: string
  answer: string
  is_correct: number | null
  score: number | null
  cefr: string | null
  feedback: string | null
  created_at: number
}

export interface MessageRow {
  id: string
  conversation_id: string
  role: string
  content: string
  meta: string | null
  created_at: number
}

export interface ConversationRow {
  id: string
  user_id: string
  title: string
  summary: string | null
  summary_message_count: number
  created_at: number
  updated_at: number
  last_message_at: number | null
}

export interface LearnerErrorRow {
  id: string
  user_id: string
  skill_id: string
  topic: string
  original: string
  correction: string
  explanation: string
  occurrences: number
  first_seen_at: number
  last_seen_at: number
}

export interface ProfileRow {
  user_id: string
  display_name: string
  native_language: string
  goals: string
  correction_preference: string
  onboarded_at: number | null
  updated_at: number
}

// ---------------------------------------------------------------- usuarios y perfil

/** App de un solo usuario: la primera fila es mía. */
export async function getOrCreateUserId(db: D1Database): Promise<string> {
  const existing = await db
    .prepare('SELECT id FROM users ORDER BY created_at LIMIT 1')
    .first<{ id: string }>()
  if (existing) return existing.id

  const id = crypto.randomUUID()
  const now = Date.now()
  await db
    .prepare('INSERT INTO users (id, created_at, last_seen_at) VALUES (?, ?, ?)')
    .bind(id, now, now)
    .run()
  return id
}

export async function touchUser(db: D1Database, userId: string): Promise<void> {
  await db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(Date.now(), userId).run()
}

export async function getProfile(db: D1Database, userId: string): Promise<Profile | null> {
  const row = await db
    .prepare(
      `SELECT user_id, display_name, native_language, goals, correction_preference, onboarded_at, updated_at
       FROM profiles WHERE user_id = ?`,
    )
    .bind(userId)
    .first<ProfileRow>()
  if (!row) return null

  let goals: string[] = []
  try {
    const parsed: unknown = JSON.parse(row.goals)
    if (Array.isArray(parsed)) goals = parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    goals = []
  }

  return {
    displayName: row.display_name,
    nativeLanguage: row.native_language,
    goals,
    correctionPreference: row.correction_preference,
    onboardedAt: row.onboarded_at,
  }
}

export async function upsertProfile(
  db: D1Database,
  userId: string,
  profile: Profile,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO profiles (user_id, display_name, native_language, goals, correction_preference, onboarded_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(user_id) DO UPDATE SET
         display_name = excluded.display_name,
         native_language = excluded.native_language,
         goals = excluded.goals,
         correction_preference = excluded.correction_preference,
         onboarded_at = excluded.onboarded_at,
         updated_at = excluded.updated_at`,
    )
    .bind(
      userId,
      profile.displayName,
      profile.nativeLanguage,
      JSON.stringify(profile.goals),
      profile.correctionPreference,
      profile.onboardedAt,
      Date.now(),
    )
    .run()
}

// ---------------------------------------------------------------- profesor

export async function getTeacherConfig(db: D1Database, userId: string): Promise<TeacherConfig> {
  const row = await db
    .prepare('SELECT config FROM teacher_profiles WHERE user_id = ?')
    .bind(userId)
    .first<{ config: string }>()
  if (!row) return { ...DEFAULT_TEACHER_CONFIG }

  try {
    const parsed = JSON.parse(row.config) as Partial<TeacherConfig>
    // Se mezcla con los valores por defecto para que añadir opciones no rompa nada.
    return { ...DEFAULT_TEACHER_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_TEACHER_CONFIG }
  }
}

export async function upsertTeacherConfig(
  db: D1Database,
  userId: string,
  config: TeacherConfig,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO teacher_profiles (user_id, config, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(user_id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at`,
    )
    .bind(userId, JSON.stringify(config), Date.now())
    .run()
}

// ---------------------------------------------------------------- personajes

export interface CharacterRow {
  id: string
  user_id: string
  name: string
  tagline: string
  config: string
  favorite: number
  sort_order: number
  created_at: number
  updated_at: number
  last_used_at: number | null
  last_viewed_at: number | null
}

const CHARACTER_COLUMNS = `id, user_id, name, tagline, config, favorite, sort_order,
  created_at, updated_at, last_used_at, last_viewed_at`

/** La ficha guardada, siempre completa: lo que falte cae en los valores por defecto. */
export function parseCharacterConfig(row: CharacterRow): TeacherConfig {
  try {
    return { ...DEFAULT_TEACHER_CONFIG, ...(JSON.parse(row.config) as Partial<TeacherConfig>) }
  } catch {
    return { ...DEFAULT_TEACHER_CONFIG }
  }
}

function isNewCharacter(row: CharacterRow, now = Date.now()): boolean {
  if (now - row.created_at > CHARACTER_NEW_DAYS * 86_400_000) return false
  // Si ya lo abriste después de crearlo, la novedad está vista.
  return row.last_viewed_at === null || row.last_viewed_at < row.created_at
}

function toCard(row: CharacterRow, messageCount: number): CharacterCard {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    avatar: parseCharacterConfig(row).avatar,
    favorite: row.favorite === 1,
    messageCount,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    isNew: isNewCharacter(row),
  }
}

/**
 * La biblioteca del usuario, con el contador de mensajes de cada uno.
 * "Mensajes" son los que escribiste tú, no las respuestas del personaje.
 */
export async function listCharacterCards(db: D1Database, userId: string): Promise<CharacterCard[]> {
  const { results } = await db
    .prepare(
      `SELECT c.id, c.user_id, c.name, c.tagline, c.config, c.favorite, c.sort_order,
              c.created_at, c.updated_at, c.last_used_at, c.last_viewed_at,
              COUNT(m.id) AS message_count
       FROM characters c
       LEFT JOIN conversations v ON v.character_id = c.id
       LEFT JOIN messages m ON m.conversation_id = v.id AND m.role = 'user'
       WHERE c.user_id = ?1
       GROUP BY c.id
       ORDER BY c.sort_order, c.created_at`,
    )
    .bind(userId)
    .all<CharacterRow & { message_count: number }>()

  return results.map((row) => toCard(row, row.message_count))
}

export async function countCharacters(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS total FROM characters WHERE user_id = ?')
    .bind(userId)
    .first<{ total: number }>()
  return row?.total ?? 0
}

export async function getCharacter(
  db: D1Database,
  userId: string,
  characterId: string,
): Promise<CharacterRow | null> {
  return db
    .prepare(`SELECT ${CHARACTER_COLUMNS} FROM characters WHERE id = ? AND user_id = ?`)
    .bind(characterId, userId)
    .first<CharacterRow>()
}

/** Cuántos mensajes tuyos llevan este personaje y sus charlas. */
export async function countCharacterMessages(
  db: D1Database,
  userId: string,
  characterId: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(m.id) AS total
       FROM conversations v
       JOIN messages m ON m.conversation_id = v.id AND m.role = 'user'
       WHERE v.user_id = ? AND v.character_id = ?`,
    )
    .bind(userId, characterId)
    .first<{ total: number }>()
  return row?.total ?? 0
}

export function toCharacterDetail(row: CharacterRow, messageCount: number): CharacterDetail {
  return { ...toCard(row, messageCount), config: parseCharacterConfig(row) }
}

export async function insertCharacter(
  db: D1Database,
  userId: string,
  input: { config: TeacherConfig },
): Promise<CharacterRow> {
  const now = Date.now()
  const id = crypto.randomUUID()
  const next = await db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM characters WHERE user_id = ?')
    .bind(userId)
    .first<{ value: number }>()

  const row: CharacterRow = {
    id,
    user_id: userId,
    name: input.config.name,
    tagline: characterTagline(input.config),
    config: JSON.stringify(input.config),
    favorite: 0,
    sort_order: next?.value ?? 0,
    created_at: now,
    updated_at: now,
    last_used_at: null,
    last_viewed_at: null,
  }

  await db
    .prepare(
      `INSERT INTO characters (id, user_id, name, tagline, config, favorite, sort_order, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(
      row.id,
      row.user_id,
      row.name,
      row.tagline,
      row.config,
      row.favorite,
      row.sort_order,
      row.created_at,
      row.updated_at,
    )
    .run()

  return row
}

export async function updateCharacter(
  db: D1Database,
  userId: string,
  characterId: string,
  config: TeacherConfig,
): Promise<void> {
  // El nombre y la frase se copian a sus columnas: la tarjeta no depende del JSON.
  await db
    .prepare(
      `UPDATE characters SET name = ?, tagline = ?, config = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
    .bind(config.name, characterTagline(config), JSON.stringify(config), Date.now(), characterId, userId)
    .run()
}

export async function setCharacterFavorite(
  db: D1Database,
  userId: string,
  characterId: string,
  favorite: boolean,
): Promise<void> {
  await db
    .prepare('UPDATE characters SET favorite = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(favorite ? 1 : 0, Date.now(), characterId, userId)
    .run()
}

export async function markCharacterViewed(
  db: D1Database,
  userId: string,
  characterId: string,
): Promise<void> {
  await db
    .prepare('UPDATE characters SET last_viewed_at = ? WHERE id = ? AND user_id = ?')
    .bind(Date.now(), characterId, userId)
    .run()
}

export async function markCharacterUsed(
  db: D1Database,
  userId: string,
  characterId: string,
): Promise<void> {
  await db
    .prepare('UPDATE characters SET last_used_at = ? WHERE id = ? AND user_id = ?')
    .bind(Date.now(), userId ? characterId : characterId, userId)
    .run()
}

/**
 * Estrena la biblioteca la primera vez: si ya tenías una ficha de profe guardada
 * se convierte en tu primer personaje; si no, se estrenan los seis arquetipos
 * originales de la app. Nunca se inventa nada con dueño.
 */
export async function ensureCharacters(db: D1Database, userId: string): Promise<void> {
  if ((await countCharacters(db, userId)) > 0) return

  const saved = await db
    .prepare('SELECT config FROM teacher_profiles WHERE user_id = ?')
    .bind(userId)
    .first<{ config: string }>()

  if (saved) {
    let config = { ...DEFAULT_TEACHER_CONFIG }
    try {
      config = { ...DEFAULT_TEACHER_CONFIG, ...(JSON.parse(saved.config) as Partial<TeacherConfig>) }
    } catch {
      config = { ...DEFAULT_TEACHER_CONFIG }
    }
    await insertCharacter(db, userId, { config })
    return
  }

  for (const persona of TEACHER_PERSONAS) {
    await insertCharacter(db, userId, { config: configFromPersona(persona) })
  }
}

// ---------------------------------------------------------------- habilidades

export async function getUserSkills(db: D1Database, userId: string): Promise<SkillProgress[]> {
  const { results } = await db
    .prepare(
      `SELECT s.code, s.name, u.score, u.cefr, u.mastery, u.attempts, u.correct,
              u.last_reviewed_at, u.next_review_at
       FROM skills s
       LEFT JOIN user_skills u ON u.skill_id = s.id AND u.user_id = ?1
       WHERE s.kind = 'skill'
       ORDER BY s.sort_order`,
    )
    .bind(userId)
    .all<{
      code: string
      name: string
      score: number | null
      cefr: string | null
      mastery: number | null
      attempts: number | null
      correct: number | null
      last_reviewed_at: number | null
      next_review_at: number | null
    }>()

  const byCode = new Map(results.map((row) => [row.code, row]))
  return SKILL_CODES.map((code) => {
    const row = byCode.get(code)
    return {
      code,
      name: row?.name ?? SKILL_NAMES[code],
      score: row?.score ?? null,
      cefr: (row?.cefr as CefrLevel | null) ?? null,
      label: row?.cefr ?? null,
      mastery: row?.mastery ?? 0,
      attempts: row?.attempts ?? 0,
      correct: row?.correct ?? 0,
      lastReviewedAt: row?.last_reviewed_at ?? null,
      nextReviewAt: row?.next_review_at ?? null,
    }
  })
}

export interface UserSkillWrite {
  code: SkillCode
  score: number | null
  cefr: string | null
  mastery: number
  attempts: number
  correct: number
}

export async function saveUserSkills(
  db: D1Database,
  userId: string,
  entries: UserSkillWrite[],
): Promise<void> {
  const now = Date.now()
  const statements = entries.map((entry) =>
    db
      .prepare(
        `INSERT INTO user_skills (user_id, skill_id, score, cefr, mastery, attempts, correct, last_reviewed_at, next_review_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(user_id, skill_id) DO UPDATE SET
           score = COALESCE(excluded.score, user_skills.score),
           cefr = COALESCE(excluded.cefr, user_skills.cefr),
           -- Las habilidades todavía no medibles no deben borrar lo ya guardado.
           mastery = CASE WHEN excluded.score IS NULL THEN user_skills.mastery ELSE excluded.mastery END,
           attempts = user_skills.attempts + excluded.attempts,
           correct = user_skills.correct + excluded.correct,
           -- next_review_at queda en null a propósito: la repetición espaciada
           -- es de una etapa siguiente y todavía no la calculamos.
           last_reviewed_at = excluded.last_reviewed_at,
           next_review_at = excluded.next_review_at`,
      )
      .bind(
        userId,
        entry.code,
        entry.score,
        entry.cefr,
        entry.mastery,
        entry.attempts,
        entry.correct,
        entry.score === null ? null : now,
        null,
      ),
  )
  if (statements.length > 0) await db.batch(statements)
}

// ---------------------------------------------------------------- test

export async function listActiveQuestions(db: D1Database, sections: string[]): Promise<QuestionRow[]> {
  const placeholders = sections.map(() => '?').join(',')
  const { results } = await db
    .prepare(
      `SELECT id, skill_id, section, cefr, position, sort_order, type, passage_id, passage_title,
              passage_text, instructions, prompt, options, answer_key, rubric
       FROM assessment_questions
       WHERE active = 1 AND section IN (${placeholders})
       ORDER BY section, position, sort_order`,
    )
    .bind(...sections)
    .all<QuestionRow>()
  return results
}

/** Un test que se dejó a medias no sirve para nada: se marca, no se borra. */
export async function abandonOpenAttempts(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE assessment_attempts SET status = 'abandoned'
       WHERE user_id = ? AND status = 'in_progress'`,
    )
    .bind(userId)
    .run()
}

export async function createAttempt(db: D1Database, userId: string): Promise<string> {
  const id = crypto.randomUUID()
  // Empezar un test cierra el anterior: si no, se acumulan intentos colgados.
  await abandonOpenAttempts(db, userId)
  await db
    .prepare(
      'INSERT INTO assessment_attempts (id, user_id, status, started_at) VALUES (?, ?, ?, ?)',
    )
    .bind(id, userId, 'in_progress', Date.now())
    .run()
  return id
}

export async function getAttempt(db: D1Database, attemptId: string): Promise<AttemptRow | null> {
  return db
    .prepare(
      `SELECT id, user_id, status, started_at, finished_at, result, provider, model
       FROM assessment_attempts WHERE id = ?`,
    )
    .bind(attemptId)
    .first<AttemptRow>()
}

export async function listAnswers(db: D1Database, attemptId: string): Promise<AnswerRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, attempt_id, question_id, answer, is_correct, score, cefr, feedback, created_at
       FROM assessment_answers WHERE attempt_id = ? ORDER BY created_at`,
    )
    .bind(attemptId)
    .all<AnswerRow>()
  return results
}

export async function insertAnswer(
  db: D1Database,
  input: {
    attemptId: string
    questionId: string
    answer: string
    isCorrect: boolean | null
    score: number | null
    cefr: string | null
    feedback: string | null
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO assessment_answers
         (id, attempt_id, question_id, answer, is_correct, score, cefr, feedback, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.attemptId,
      input.questionId,
      input.answer,
      input.isCorrect === null ? null : input.isCorrect ? 1 : 0,
      input.score,
      input.cefr,
      input.feedback,
      Date.now(),
    )
    .run()
}

export async function finishAttempt(
  db: D1Database,
  attemptId: string,
  result: unknown,
  provider: string,
  model: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE assessment_attempts
       SET status = 'done', finished_at = ?, result = ?, provider = ?, model = ?
       WHERE id = ?`,
    )
    .bind(Date.now(), JSON.stringify(result), provider, model, attemptId)
    .run()
}

export async function getLatestFinishedAttempt(
  db: D1Database,
  userId: string,
): Promise<AttemptRow | null> {
  return db
    .prepare(
      `SELECT id, user_id, status, started_at, finished_at, result, provider, model
       FROM assessment_attempts
       WHERE user_id = ? AND status = 'done' AND result IS NOT NULL
       ORDER BY finished_at DESC LIMIT 1`,
    )
    .bind(userId)
    .first<AttemptRow>()
}

// ---------------------------------------------------------------- errores repetidos

export async function upsertLearnerError(
  db: D1Database,
  input: {
    userId: string
    skill: SkillCode
    topic: string
    original: string
    correction: string
    explanation: string
  },
): Promise<LearnerError> {
  const now = Date.now()
  const topic = input.topic.slice(0, 80)
  const original = input.original.slice(0, 200)
  const correction = input.correction.slice(0, 200)
  const explanation = input.explanation.slice(0, 300)

  await db
    .prepare(
      `INSERT INTO learner_errors
         (id, user_id, skill_id, topic, original, correction, explanation, occurrences, first_seen_at, last_seen_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?8)
       ON CONFLICT(user_id, topic, original, correction) DO UPDATE SET
         occurrences = learner_errors.occurrences + 1,
         last_seen_at = excluded.last_seen_at,
         explanation = excluded.explanation`,
    )
    .bind(crypto.randomUUID(), input.userId, input.skill, topic, original, correction, explanation, now)
    .run()

  const row = await db
    .prepare(
      `SELECT id, user_id, skill_id, topic, original, correction, explanation, occurrences, first_seen_at, last_seen_at
       FROM learner_errors
       WHERE user_id = ? AND topic = ? AND original = ? AND correction = ?`,
    )
    .bind(input.userId, topic, original, correction)
    .first<LearnerErrorRow>()

  if (!row) throw new Error('No se pudo guardar el error del alumno.')
  return toLearnerError(row)
}

export async function listTopErrors(
  db: D1Database,
  userId: string,
  limit: number,
): Promise<LearnerError[]> {
  const { results } = await db
    .prepare(
      `SELECT id, user_id, skill_id, topic, original, correction, explanation, occurrences, first_seen_at, last_seen_at
       FROM learner_errors WHERE user_id = ?
       ORDER BY occurrences DESC, last_seen_at DESC LIMIT ?`,
    )
    .bind(userId, limit)
    .all<LearnerErrorRow>()
  return results.map(toLearnerError)
}

export function toLearnerError(row: LearnerErrorRow): LearnerError {
  return {
    id: row.id,
    skill: row.skill_id as SkillCode,
    topic: row.topic,
    original: row.original,
    correction: row.correction,
    explanation: row.explanation,
    occurrences: row.occurrences,
    lastSeenAt: row.last_seen_at,
  }
}

// ---------------------------------------------------------------- charla

export async function listConversations(
  db: D1Database,
  userId: string,
): Promise<Conversation[]> {
  const { results } = await db
    .prepare(
      `SELECT id, user_id, title, summary, summary_message_count, created_at, updated_at, last_message_at
       FROM conversations WHERE user_id = ?
       ORDER BY COALESCE(last_message_at, created_at) DESC LIMIT 50`,
    )
    .bind(userId)
    .all<ConversationRow>()
  return results.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    lastMessageAt: row.last_message_at,
  }))
}

export async function createConversation(
  db: D1Database,
  userId: string,
  title: string,
): Promise<Conversation> {
  const now = Date.now()
  const id = crypto.randomUUID()
  // El mismo texto que se guarda es el que devuelvo, así no hay sorpresas.
  const cleanTitle = title.trim().slice(0, 80) || 'Charla'
  await db
    .prepare(
      `INSERT INTO conversations (id, user_id, title, created_at, updated_at, last_message_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
    )
    .bind(id, userId, cleanTitle, now, now)
    .run()
  return { id, title: cleanTitle, summary: null, lastMessageAt: null }
}

export async function getConversation(
  db: D1Database,
  userId: string,
  conversationId: string,
): Promise<ConversationRow | null> {
  return db
    .prepare(
      `SELECT id, user_id, title, summary, summary_message_count, created_at, updated_at, last_message_at
       FROM conversations WHERE id = ? AND user_id = ?`,
    )
    .bind(conversationId, userId)
    .first<ConversationRow>()
}

export async function listMessages(
  db: D1Database,
  conversationId: string,
  limit: number,
): Promise<MessageRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, conversation_id, role, content, meta, created_at
       FROM messages WHERE conversation_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(conversationId, limit)
    .all<MessageRow>()
  return results.reverse()
}

export async function countMessagesByRole(
  db: D1Database,
  conversationId: string,
  role: string,
): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS total FROM messages WHERE conversation_id = ? AND role = ?')
    .bind(conversationId, role)
    .first<{ total: number }>()
  return row?.total ?? 0
}

export async function insertMessage(
  db: D1Database,
  input: { conversationId: string; role: 'user' | 'assistant'; content: string; meta?: unknown },
): Promise<ChatMessage> {
  const now = Date.now()
  const id = crypto.randomUUID()
  await db
    .prepare(
      'INSERT INTO messages (id, conversation_id, role, content, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(id, input.conversationId, input.role, input.content, input.meta ? JSON.stringify(input.meta) : null, now)
    .run()
  await db
    .prepare('UPDATE conversations SET updated_at = ?, last_message_at = ? WHERE id = ?')
    .bind(now, now, input.conversationId)
    .run()
  return { id, role: input.role, content: input.content, createdAt: now, corrections: [] }
}

export function toChatMessage(row: MessageRow): ChatMessage {
  let corrections: LearnerError[] = []
  if (row.meta) {
    try {
      const parsed = JSON.parse(row.meta) as { corrections?: LearnerError[] }
      if (Array.isArray(parsed.corrections)) corrections = parsed.corrections
    } catch {
      corrections = []
    }
  }
  return {
    id: row.id,
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    createdAt: row.created_at,
    corrections,
  }
}

export async function saveConversationSummary(
  db: D1Database,
  conversationId: string,
  summary: string,
  messageCount: number,
): Promise<void> {
  await db
    .prepare('UPDATE conversations SET summary = ?, summary_message_count = ?, updated_at = ? WHERE id = ?')
    .bind(summary, messageCount, Date.now(), conversationId)
    .run()
}

// ---------------------------------------------------------------- límites (intentos y cuota)

export interface LoginAttemptRow {
  failures: number
  window_start: number
  blocked_until: number
}

export async function getLoginAttempt(db: D1Database, ip: string): Promise<LoginAttemptRow | null> {
  return db
    .prepare('SELECT failures, window_start, blocked_until FROM login_attempts WHERE ip = ?')
    .bind(ip)
    .first<LoginAttemptRow>()
}

/** Suma un fallo. `windowStart` en 0 significa empezar una ventana nueva. */
export async function saveLoginFailure(
  db: D1Database,
  input: { ip: string; failures: number; windowStart: number; blockedUntil: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO login_attempts (ip, failures, window_start, blocked_until)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(ip) DO UPDATE SET
         failures = excluded.failures,
         window_start = excluded.window_start,
         blocked_until = excluded.blocked_until`,
    )
    .bind(input.ip, input.failures, input.windowStart, input.blockedUntil)
    .run()
}

export async function clearLoginAttempts(db: D1Database, ip: string): Promise<void> {
  await db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run()
}

/** Día en UTC, que es como se reinician las cuotas gratis de los proveedores. */
export function utcDay(at: number = Date.now()): string {
  return new Date(at).toISOString().slice(0, 10)
}

export async function countAiCalls(db: D1Database, day: string): Promise<number> {
  const row = await db
    .prepare('SELECT calls FROM ai_usage WHERE day = ?')
    .bind(day)
    .first<{ calls: number }>()
  return row?.calls ?? 0
}

/** Suma una llamada al contador del día y devuelve el total acumulado. */
export async function registerAiCall(db: D1Database, day: string): Promise<number> {
  await db
    .prepare(
      `INSERT INTO ai_usage (day, calls) VALUES (?1, 1)
       ON CONFLICT(day) DO UPDATE SET calls = calls + 1`,
    )
    .bind(day)
    .run()

  const row = await db.prepare('SELECT calls FROM ai_usage WHERE day = ?').bind(day).first<{ calls: number }>()
  return row?.calls ?? 0
}
