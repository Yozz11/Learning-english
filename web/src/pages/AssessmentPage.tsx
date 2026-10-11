import type {
  AssessmentAnswerResponse,
  AssessmentQuestion,
  AssessmentResult,
  AssessmentStartResponse,
} from '@english-coach/shared'
import { SKILL_NAMES } from '@english-coach/shared'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, LoadingBox, Note, ProgressBar, SkillMeter } from '../components/ui'
import { api, errorMessage } from '../lib/api'

type Phase =
  | { kind: 'intro' }
  | { kind: 'question'; attemptId: string; question: AssessmentQuestion; answered: number; total: number }
  | { kind: 'done'; result: AssessmentResult }

export function AssessmentPage() {
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [writing, setWriting] = useState('')

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const response = await api.post<AssessmentStartResponse>('/api/assessment/start')
      setPhase({
        kind: 'question',
        attemptId: response.attemptId,
        question: response.question,
        answered: response.answered,
        total: response.total,
      })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function answer(value: string) {
    if (phase.kind !== 'question') return

    setBusy(true)
    setError(null)
    try {
      const response = await api.post<AssessmentAnswerResponse>('/api/assessment/answer', {
        attemptId: phase.attemptId,
        questionId: phase.question.id,
        answer: value,
      })
      setSelected(null)
      setWriting('')

      if (response.done) {
        setPhase({ kind: 'done', result: response.result })
      } else {
        setPhase({
          kind: 'question',
          attemptId: phase.attemptId,
          question: response.question,
          answered: response.answered,
          total: response.total,
        })
      }
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  if (phase.kind === 'intro') {
    return (
      <>
        <Card>
          <h2>Test de nivel</h2>
          <h1 style={{ marginTop: 8 }}>¿Dónde estás parado?</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Cuatro partes: gramática, vocabulario, lectura y escritura. La dificultad sube o baja según
            tus respuestas, así que no hace falta contestar todo. Suele ser entre 11 y 20 preguntas.
          </p>
          <div className="row" style={{ marginTop: 16 }}>
            <Button variant="primary" onClick={start} disabled={busy}>
              {busy ? 'Preparando…' : 'Empezar'}
            </Button>
          </div>
        </Card>
        {error ? <Alert>{error}</Alert> : null}
        <Note>
          Las preguntas de escritura las evalúa la IA con una rúbrica. Tarda unos segundos más.
        </Note>
      </>
    )
  }

  if (phase.kind === 'done') {
    return <ResultView result={phase.result} />
  }

  const { question, answered, total } = phase

  return (
    <>
      <Card>
        <div className="box-head">
          <h2>{SKILL_NAMES[question.skill]}</h2>
          <span className="tiny">
            {answered + 1} de {total} (máx.)
          </span>
        </div>
        <ProgressBar value={answered} max={total} />
      </Card>

      <Card>
        {question.passage ? (
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ marginBottom: 8 }}>{question.passage.title}</h3>
            <div className="passage">{question.passage.text}</div>
          </div>
        ) : null}

        <p className="tiny" style={{ marginBottom: 8 }}>
          {question.instructions}
        </p>
        <h3 style={{ marginBottom: 14 }}>{question.prompt}</h3>

        {question.options ? (
          <div className="stack" style={{ paddingTop: 0 }}>
            {question.options.map((option, index) => (
              <button
                key={option}
                type="button"
                className={selected === index ? 'option selected' : 'option'}
                disabled={busy}
                onClick={() => {
                  setSelected(index)
                  void answer(String(index))
                }}
              >
                <span className="option-key">{String.fromCharCode(65 + index)}</span>
                <span>{option}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="stack" style={{ paddingTop: 0 }}>
            <textarea
              value={writing}
              onChange={(event) => setWriting(event.target.value)}
              placeholder="Write your answer in English…"
              rows={6}
              disabled={busy}
            />
            <Button
              variant="primary"
              disabled={busy || writing.trim().length < 10}
              onClick={() => void answer(writing.trim())}
            >
              {busy ? 'Evaluando…' : 'Enviar'}
            </Button>
          </div>
        )}
      </Card>

      {busy ? (
        <Card soft>
          <div className="row">
            <span className="spinner" />
            <span className="muted">Pensando…</span>
          </div>
        </Card>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}
    </>
  )
}

function ResultView({ result }: { result: AssessmentResult }) {
  return (
    <>
      <Card>
        <h2>Resultado</h2>
        <h1 style={{ marginTop: 8 }}>Listo, ya sé dónde estás</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Esto es orientativo: lo importante es lo que hagas de aquí en adelante.
        </p>
      </Card>

      <Card>
        <div className="box-head">
          <h2>Por habilidad</h2>
        </div>
        <div className="stack" style={{ paddingTop: 0 }}>
          {result.skills.map((skill) => (
            <SkillMeter key={skill.code} skill={skill} />
          ))}
        </div>
      </Card>

      {result.strengths.length > 0 ? (
        <Card>
          <div className="box-head">
            <h2>Lo que ya haces bien</h2>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {result.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {result.weaknesses.length > 0 ? (
        <Card>
          <div className="box-head">
            <h2>Lo que hay que trabajar</h2>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {result.weaknesses.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {result.errors.length > 0 ? (
        <Card>
          <div className="box-head">
            <h2>Errores detectados</h2>
          </div>
          <div className="stack" style={{ paddingTop: 0 }}>
            {result.errors.map((mistake) => (
              <div key={mistake.id} className="correction">
                <b>{mistake.correction}</b>
                <div className="tiny">
                  En vez de “{mistake.original}” · {mistake.topic}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="row">
        <Link to="/">
          <Button variant="primary">Ir al inicio</Button>
        </Link>
        <Link to="/chat">
          <Button>Hablar con el profe</Button>
        </Link>
      </div>

      <p className="tiny" style={{ textAlign: 'center' }}>
        Listening, speaking y pronunciación se miden en la etapa 2.
      </p>
    </>
  )
}
