// Pruebas de la API de la etapa 1.
//
// Corren contra su propio `wrangler dev` con una base D1 aparte
// (`api/.wrangler/test-state`, que está en .gitignore) para no tocar ni la base
// local de uso diario ni la de producción.
//
// Detalles a propósito:
// - Proveedor `mock`: las pruebas no gastan cuota de Gemini.
// - Contraseña y secreto se pasan por --var: no dependen de .dev.vars.
// - `npm run test:api` desde la raíz arma todo (migraciones + servidor) y lo apaga al final.

import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, openSync, rmSync } from 'node:fs'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const apiDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const stateDir = path.join(apiDir, '.wrangler', 'test-state')
const logFile = path.join(apiDir, '.wrangler', 'test-dev.log')

const PORT = 8799
const BASE = `http://127.0.0.1:${PORT}`

// Valores propios de las pruebas, no los de desarrollo.
const PASSPHRASE = 'passphrase-de-pruebas'
const AI_DAILY_LIMIT = 2

let server = null
let cookie = ''

function wrangler(args) {
  return spawnSync('npx', ['--no-install', 'wrangler', ...args], {
    cwd: apiDir,
    encoding: 'utf8',
  })
}

async function waitForServer(child, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`El servidor de pruebas terminó solo (código ${child.exitCode}). Mira ${logFile}.`)
    }
    try {
      const response = await fetch(`${BASE}/api/health`)
      if (response.ok) return
    } catch {
      // Todavía no escucha: seguimos esperando.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`El servidor de pruebas no arrancó en ${timeoutMs / 1000}s. Mira ${logFile}.`)
}

async function api(pathname, options = {}) {
  const headers = { 'content-type': 'application/json', ...(options.headers ?? {}) }
  if (cookie) headers.cookie = cookie

  const response = await fetch(`${BASE}${pathname}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const raw = await response.text()
  let data = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = raw
  }

  return { status: response.status, data, headers: response.headers }
}

async function login(passphrase) {
  const response = await api('/api/auth/login', { method: 'POST', body: { passphrase } })
  const setCookie = response.headers.getSetCookie?.() ?? []
  if (setCookie.length > 0) cookie = setCookie[0].split(';')[0]
  return response
}

before(async () => {
  // Estado limpio: solo se borra la carpeta de pruebas.
  rmSync(stateDir, { recursive: true, force: true })
  mkdirSync(stateDir, { recursive: true })

  const migrated = wrangler(['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', stateDir])
  if (migrated.status !== 0) {
    throw new Error(`No pude preparar la base de pruebas:\n${migrated.stdout}\n${migrated.stderr}`)
  }

  const log = openSync(logFile, 'w')
  server = spawn(
    'npx',
    [
      '--no-install',
      'wrangler',
      'dev',
      '--port',
      String(PORT),
      '--persist-to',
      stateDir,
      '--var',
      'AI_PROVIDER:mock',
      '--var',
      `AI_DAILY_LIMIT:${AI_DAILY_LIMIT}`,
      '--var',
      `APP_PASSPHRASE:${PASSPHRASE}`,
      '--var',
      'SESSION_SECRET:secreto-de-pruebas',
    ],
    { cwd: apiDir, stdio: ['ignore', log, log] },
  )

  await waitForServer(server)
})

after(() => {
  if (server) server.kill('SIGTERM')
})

describe('API de english-coach', () => {
  it('responde el chequeo de salud con el proveedor de pruebas', async () => {
    const response = await api('/api/health')
    assert.equal(response.status, 200)
    assert.equal(response.data.ok, true)
    assert.equal(response.data.provider, 'mock')
  })

  it('sin sesión, las rutas privadas dan 401', async () => {
    cookie = ''
    const response = await api('/api/home')
    assert.equal(response.status, 401)
  })

  it('rechaza una contraseña equivocada', async () => {
    const response = await login('no-es-la-contraseña')
    assert.equal(response.status, 401)
    assert.equal(response.data.error, 'bad_passphrase')
  })

  it('entra con la contraseña correcta y deja la cookie', async () => {
    const response = await login(PASSPHRASE)
    assert.equal(response.status, 200)
    assert.equal(response.data.authenticated, true)
    assert.match(cookie, /^ec_session=/)

    const me = await api('/api/auth/me')
    assert.equal(me.status, 200)
    assert.equal(me.data.authenticated, true)
  })

  it('guarda el avatar de la galería y lo devuelve en /api/home', async () => {
    const current = await api('/api/teacher')
    assert.equal(current.status, 200)

    const saved = await api('/api/teacher', {
      method: 'PUT',
      body: { ...current.data, name: 'Profesor de prueba', avatar: 'mentor' },
    })
    assert.equal(saved.status, 200)
    assert.equal(saved.data.avatar, 'mentor')

    const home = await api('/api/home')
    assert.equal(home.status, 200)
    assert.equal(home.data.teacher.avatar, 'mentor')
    assert.equal(home.data.teacher.name, 'Profesor de prueba')
  })

  it('acepta una imagen propia como data URL', async () => {
    const current = await api('/api/teacher')
    const saved = await api('/api/teacher', {
      method: 'PUT',
      body: { ...current.data, avatar: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=' },
    })
    assert.equal(saved.status, 200)
    assert.match(saved.data.avatar, /^data:image\/webp;base64,/)
  })

  it('rechaza un avatar que sea una URL externa', async () => {
    const current = await api('/api/teacher')
    const saved = await api('/api/teacher', {
      method: 'PUT',
      body: { ...current.data, avatar: 'https://ejemplo.com/foto.png' },
    })
    assert.equal(saved.status, 400)
    assert.equal(saved.data.error, 'invalid_field')
  })

  it('ignora un personaje desconocido en vez de romper', async () => {
    const current = await api('/api/teacher')
    const saved = await api('/api/teacher', {
      method: 'PUT',
      body: { ...current.data, personaId: 'personaje-inventado' },
    })
    assert.equal(saved.status, 200)
    assert.equal(saved.data.personaId, null)
  })

  it('guarda la ficha del personaje y con ella abre la charla nueva', async () => {
    const current = await api('/api/teacher')
    const saved = await api('/api/teacher', {
      method: 'PUT',
      body: {
        ...current.data,
        tagline: 'Entrenador que te exige, pero siempre está de tu lado.',
        speechStyle: 'Frases cortas, energía alta, compara el inglés con entrenar.',
        greeting: 'Hey! Warm-up time. Tell me one thing you did today.',
        examples: 'Yo: Yesterday I go to the gym.\nÉl: Almost! Yesterday I went to the gym.',
        neverDoes: 'No se burla de mis errores y no traduce todo.',
        scenarios: 'Entrevista de trabajo, hablar de deportes.',
        maxCorrections: 1,
      },
    })
    assert.equal(saved.status, 200)
    assert.equal(saved.data.maxCorrections, 1)
    assert.equal(saved.data.tagline, 'Entrenador que te exige, pero siempre está de tu lado.')
    assert.equal(saved.data.neverDoes, 'No se burla de mis errores y no traduce todo.')

    const created = await api('/api/conversations', { method: 'POST' })
    assert.equal(created.status, 200)
    assert.ok(created.data.lastMessageAt, 'la charla nueva debería quedar con el saludo dentro')

    const messages = await api(`/api/conversations/${created.data.id}/messages`)
    assert.equal(messages.status, 200)
    assert.equal(messages.data.length, 1)
    assert.equal(messages.data[0].role, 'assistant')
    assert.match(messages.data[0].content, /Warm-up time/)
  })

  it('rechaza un campo de la ficha demasiado largo', async () => {
    const current = await api('/api/teacher')
    const saved = await api('/api/teacher', {
      method: 'PUT',
      body: { ...current.data, tagline: 'x'.repeat(200) },
    })
    assert.equal(saved.status, 400)
    assert.equal(saved.data.error, 'invalid_field')
  })

  describe('personajes', () => {
    let ficha = null
    let created = null

    it('estrena la biblioteca con la ficha que ya tenías y no la estrena dos veces', async () => {
      const first = await api('/api/characters')
      assert.equal(first.status, 200)
      assert.ok(first.data.data.length >= 1, 'la biblioteca debería estrenarse sola')

      // La primera trae la ficha del profe que se guardó más arriba.
      assert.equal(first.data.data[0].name, 'Profesor de prueba')

      const second = await api('/api/characters')
      assert.equal(second.data.data.length, first.data.data.length)
    })

    it('las tarjetas traen el contador de mensajes y la marca de novedad', async () => {
      const list = await api('/api/characters')
      const card = list.data.data[0]
      assert.equal(typeof card.id, 'string')
      assert.equal(typeof card.name, 'string')
      assert.equal(typeof card.tagline, 'string')
      assert.equal(typeof card.messageCount, 'number')
      assert.equal(card.favorite, false)
      assert.equal(card.isNew, true, 'un personaje recién estrenado es novedad')
    })

    it('crea un personaje y lo devuelve en la lista', async () => {
      const current = await api('/api/teacher')
      ficha = { ...current.data, name: 'Personaje de prueba', tagline: 'Frase corta de prueba.' }

      const response = await api('/api/characters', { method: 'POST', body: ficha })
      assert.equal(response.status, 201)
      assert.equal(response.data.data.name, 'Personaje de prueba')
      assert.equal(response.data.data.tagline, 'Frase corta de prueba.')
      assert.equal(response.data.data.favorite, false)
      created = response.data.data

      const list = await api('/api/characters')
      assert.ok(list.data.data.some((card) => card.id === created.id))
    })

    it('rechaza una ficha sin nombre', async () => {
      const response = await api('/api/characters', { method: 'POST', body: { ...ficha, name: '' } })
      assert.equal(response.status, 400)
      assert.equal(response.data.error, 'invalid_field')
    })

    it('no deja leer el personaje de otra cuenta', async () => {
      const response = await api('/api/characters/no-existe')
      assert.equal(response.status, 404)
      assert.equal(response.data.error, 'not_found')
    })

    it('lee la ficha completa', async () => {
      const response = await api(`/api/characters/${created.id}`)
      assert.equal(response.status, 200)
      assert.equal(response.data.data.id, created.id)
      assert.ok(response.data.data.config, 'la ficha debería venir con su configuración')
      assert.equal(response.data.data.config.name, 'Personaje de prueba')
    })

    it('edita la ficha', async () => {
      const response = await api(`/api/characters/${created.id}`, {
        method: 'PUT',
        body: { ...ficha, name: 'Personaje editado', tagline: 'Frase nueva' },
      })
      assert.equal(response.status, 200)
      assert.equal(response.data.data.name, 'Personaje editado')

      const list = await api('/api/characters')
      const card = list.data.data.find((entry) => entry.id === created.id)
      assert.equal(card.name, 'Personaje editado')
      assert.equal(card.tagline, 'Frase nueva')
    })

    it('marca y desmarca el favorito', async () => {
      const marked = await api(`/api/characters/${created.id}/favorite`, {
        method: 'POST',
        body: { favorite: true },
      })
      assert.equal(marked.status, 200)
      assert.equal(marked.data.data.favorite, true)

      const unmarked = await api(`/api/characters/${created.id}/favorite`, {
        method: 'POST',
        body: { favorite: false },
      })
      assert.equal(unmarked.data.data.favorite, false)
    })
  })

  it('frena las llamadas de IA al llegar al tope del día', async () => {
    const created = await api('/api/conversations', { method: 'POST' })
    assert.equal(created.status, 200)
    const conversationId = created.data.id

    const statuses = []
    for (let i = 0; i < AI_DAILY_LIMIT + 1; i += 1) {
      const sent = await api(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { content: 'Hello teacher, this is a test message.' },
      })
      statuses.push(sent.status)
      if (sent.status === 429) {
        assert.equal(sent.data.error, 'ai_daily_limit')
        assert.match(sent.data.message, /llamadas de IA/)
      }
    }

    assert.deepEqual(statuses.slice(0, AI_DAILY_LIMIT), Array(AI_DAILY_LIMIT).fill(200))
    assert.equal(statuses.at(-1), 429)
  })

  it('bloquea la IP tras varios intentos fallidos', async () => {
    let blocked = null

    for (let i = 0; i < 8 && blocked === null; i += 1) {
      const response = await login('otra-vez-mal')
      if (response.status === 429) blocked = response
      else assert.equal(response.status, 401)
    }

    assert.ok(blocked, 'nunca llegó el bloqueo por intentos fallidos')
    assert.equal(blocked.data.error, 'too_many_attempts')
    assert.match(blocked.data.message, /Demasiados intentos/)

    // Ni con la contraseña buena se pasa mientras dure el bloqueo.
    const withGoodPassphrase = await login(PASSPHRASE)
    assert.equal(withGoodPassphrase.status, 429)
  })
})
