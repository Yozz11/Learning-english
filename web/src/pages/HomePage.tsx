import type { HomeData, SkillProgress } from '@english-coach/shared'
import { scoreLabel } from '@english-coach/shared'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, LevelChip, LoadingBox, SkillMeter } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { formatDate, formatRelative } from '../lib/format'

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api
      .get<HomeData>('/api/home')
      .then((result) => {
        if (active) setData(result)
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught))
      })
    return () => {
      active = false
    }
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!data) return <LoadingBox />

  const measured = data.skills.filter(
    (skill): skill is SkillProgress & { score: number } => skill.score !== null,
  )
  const overall =
    measured.length > 0 ? measured.reduce((total, skill) => total + skill.score, 0) / measured.length : null
  const overallLabel = overall === null ? null : scoreLabel(overall)

  return (
    <>
      <Card>
        <div className="card-head">
          <h2>Ahora</h2>
          {overall !== null ? <LevelChip label={overallLabel ?? null} /> : null}
        </div>
        <h1>{data.task.title}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {data.task.description}
        </p>
        <div style={{ marginTop: 14 }}>
          <Link to={data.task.href}>
            <Button variant="primary">Vamos</Button>
          </Link>
        </div>
      </Card>

      <Card>
        <div className="card-head">
          <h2>Mi nivel</h2>
          <span className="tiny">
            {data.hasAssessment && data.lastAssessmentAt
              ? `medido ${formatRelative(data.lastAssessmentAt)}`
              : 'sin medir'}
          </span>
        </div>
        <div className="stack" style={{ paddingTop: 0 }}>
          {data.skills.map((skill) => (
            <SkillMeter key={skill.code} name={skill.name} label={skill.label} score={skill.score} />
          ))}
        </div>
        {overall === null ? (
          <p className="tiny" style={{ marginTop: 12 }}>
            El test de nivel mide gramática, vocabulario, lectura y escritura. Listening, speaking y
            pronunciación quedan para la etapa 2.
          </p>
        ) : null}
      </Card>

      {data.topErrors.length > 0 ? (
        <Card>
          <div className="card-head">
            <h2>Errores que repito</h2>
          </div>
          <div className="stack" style={{ paddingTop: 0 }}>
            {data.topErrors.map((mistake) => (
              <div key={mistake.id} className="correction">
                <b>{mistake.correction}</b>
                <div className="tiny">
                  En vez de “{mistake.original}” · x{mistake.occurrences}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card soft>
        <div className="card-head">
          <h2>Mi profe</h2>
        </div>
        <p>
          <strong>{data.teacher.name}</strong>
        </p>
        <p className="muted">{data.teacher.personality}</p>
        <div className="row" style={{ marginTop: 12 }}>
          <Link to="/profesor">
            <Button className="btn-small">Ajustar</Button>
          </Link>
          <Link to="/chat">
            <Button className="btn-small" variant="ghost">
              Hablar
            </Button>
          </Link>
        </div>
      </Card>

      <p className="tiny" style={{ textAlign: 'center' }}>
        {data.hasAssessment && data.lastAssessmentAt
          ? `Último test: ${formatDate(data.lastAssessmentAt)}`
          : 'Todavía no hiciste el test de nivel.'}
      </p>
    </>
  )
}
