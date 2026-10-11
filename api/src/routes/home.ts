import type { HomeData, HomeTask, SkillProgress } from '@english-coach/shared'
import { SKILL_NAMES } from '@english-coach/shared'
import {
  getLatestFinishedAttempt,
  getProfile,
  getTeacherConfig,
  getUserSkills,
  listTopErrors,
} from '../db/queries'
import { json } from '../lib/http'
import type { RouteHandler } from '../lib/router'

const RETAKE_AFTER_DAYS = 30

/** La regla de "qué hago ahora": barata, sin gastar modelo y fácil de explicar. */
function chooseTask(
  onboarded: boolean,
  hasAssessment: boolean,
  lastAssessmentAt: number | null,
  skills: SkillProgress[],
): HomeTask {
  if (!onboarded) {
    return {
      kind: 'profile',
      title: 'Cuéntame de ti',
      description: 'Tres datos y tu profesor ya sabe con quién habla.',
      href: '/perfil',
    }
  }

  if (!hasAssessment) {
    return {
      kind: 'assessment',
      title: 'Hagamos el test de nivel',
      description: 'Entre 11 y 20 preguntas: gramática, vocabulario, lectura y escritura.',
      href: '/test',
    }
  }

  const daysSince = lastAssessmentAt ? (Date.now() - lastAssessmentAt) / 86_400_000 : 0
  if (daysSince > RETAKE_AFTER_DAYS) {
    return {
      kind: 'assessment',
      title: 'Ya toca medirme otra vez',
      description: `Tu último test fue hace ${Math.round(daysSince)} días. Conviene ver si subiste.`,
      href: '/test',
    }
  }

  const measured = skills.filter((skill): skill is SkillProgress & { score: number } => skill.score !== null)
  const weakest = [...measured].sort((a, b) => a.score - b.score)[0]
  if (weakest && weakest.score < 2) {
    return {
      kind: 'review',
      title: `A reforzar ${SKILL_NAMES[weakest.code].toLowerCase()}`,
      description: `Fue tu punto más flojo (${weakest.label}). Habla con el profesor de eso.`,
      href: '/chat',
    }
  }

  return {
    kind: 'chat',
    title: 'Una charla corta',
    description: 'Cinco minutos hablando en inglés valen más que leer teoría.',
    href: '/chat',
  }
}

export const home: RouteHandler = async ({ env, userId }) => {
  const [profile, skills, attempt, teacher, errors] = await Promise.all([
    getProfile(env.DB, userId),
    getUserSkills(env.DB, userId),
    getLatestFinishedAttempt(env.DB, userId),
    getTeacherConfig(env.DB, userId),
    listTopErrors(env.DB, userId, 5),
  ])

  const lastAssessmentAt = attempt?.finished_at ?? null
  const data: HomeData = {
    hasProfile: Boolean(profile?.onboardedAt),
    hasAssessment: attempt !== null,
    task: chooseTask(Boolean(profile?.onboardedAt), attempt !== null, lastAssessmentAt, skills),
    skills,
    lastAssessmentAt,
    teacher,
    topErrors: errors,
  }
  return json(data)
}
