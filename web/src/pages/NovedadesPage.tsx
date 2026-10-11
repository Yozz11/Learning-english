import type { HomeData } from '@english-coach/shared'
import { useEffect, useState } from 'react'
import { Card, LoadingBox } from '../components/ui'
import { api, errorMessage } from '../lib/api'

type NewsItem = {
  title: string
  source: string
  summary: string
  tags: string[]
}

type NewsSection = {
  title: string
  description: string
  items: NewsItem[]
}

function makeMockSections(topics: string[]): NewsSection[] {
  if (topics.length === 0) {
    return [
      {
        title: 'Vocabulario básico',
        description: 'Lo más útil para empezar a hablar con naturalidad.',
        items: [
          {
            title: 'Verbos irregulares: los 10 que más salen',
            source: 'English Coach',
            summary: 'Concéntrate en los que repites todos los días. Pequeños repasos valen más.',
            tags: ['verbos', 'irregulares'],
          },
          {
            title: 'Palabras de uso diario para mantener una charla',
            source: 'English Coach',
            summary: 'Frases cortas para no bloquearte cuando buscas la palabra.',
            tags: ['vocabulario', 'diario'],
          },
          {
            title: 'Preposiciones: el pequeño detalle que marca la diferencia',
            source: 'English Coach',
            summary: 'Un repaso por in/on/at y at/to/for para dejar de dudar.',
            tags: ['preposiciones'],
          },
        ],
      },
      {
        title: 'Correcciones útiles',
        description: 'Lo que más te conviene pulir según lo que has practicado.',
        items: [
          {
            title: 'Pasado simple vs presente perfecto: cuándo usar cada uno',
            source: 'English Coach',
            summary: 'La clave está en si el tiempo es concreto o no.',
            tags: ['pasado', 'tiempos'],
          },
          {
            title: 'Artículos: a/an/the sin darle mil vueltas',
            source: 'English Coach',
            summary: 'Reglas cortas y ejemplos reales para usarlo sin pensarlo.',
            tags: ['artículos'],
          },
        ],
      },
    ]
  }

  return topics.slice(0, 4).map((topic) => {
    const clean = topic.charAt(0).toUpperCase() + topic.slice(1)
    return {
      title: clean,
      description: 'Noticias y consejos relacionados con lo que estás corrigiendo.',
      items: [
        {
          title: `${clean}: cómo dejar de equivocarte con ello`,
          source: 'English Coach',
          summary: 'Trucos cortos para fijarlo con 5 minutos al día.',
          tags: [topic.toLowerCase().slice(0, 20)],
        },
        {
          title: `Ejemplos reales para practicar ${topic.toLowerCase()}`,
          source: 'English Coach',
          summary: 'Diálogos breves para usarlo hoy mismo en la charla.',
          tags: [topic.toLowerCase().slice(0, 20)],
        },
        {
          title: `Errores típicos con ${topic.toLowerCase()}`,
          source: 'English Coach',
          summary: 'Los fallos más comunes y cómo corregirlos de un golpe.',
          tags: [topic.toLowerCase().slice(0, 20)],
        },
      ],
    }
  })
}

export function NovedadesPage() {
  const [sections, setSections] = useState<NewsSection[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api
      .get<HomeData>('/api/home')
      .then((home) => {
        if (!active) return
        const seen = new Set<string>()
        const topics = home.topErrors
          .map((item) => item.topic.trim())
          .filter((topic) => topic !== '' && !seen.has(topic) && seen.add(topic))
        setSections(makeMockSections(topics))
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught))
        if (active) setSections(makeMockSections([]))
      })
    return () => {
      active = false
    }
  }, [])

  if (error && !sections) return <div className="pantalla">{error}</div>
  if (!sections) return <LoadingBox />

  return (
    <div className="pantalla novedades">
      <header className="editor-head">
        <h1 className="editor-title">Novedades</h1>
        <span className="tiny">Por ahora: tendencias y consejos según lo que has aprendido</span>
      </header>

      {sections.map((section) => (
        <Card key={section.title}>
          <div className="box-head">
            <h2>{section.title}</h2>
          </div>
          <p className="muted" style={{ marginBottom: 14 }}>
            {section.description}
          </p>
          <div className="stack">
            {section.items.map((item) => (
              <article key={item.title} className="news-item">
                <h3 className="news-title">{item.title}</h3>
                <p className="news-summary">{item.summary}</p>
                <div className="news-meta">
                  <span className="news-source">{item.source}</span>
                  <div className="chips">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="chip">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Card>
      ))}

      <p className="tiny" style={{ textAlign: 'center' }}>
        Las tendencias de X llegarán aquí cuando estén listas. Por ahora ves lo que más conviene repasar.
      </p>
    </div>
  )
}
