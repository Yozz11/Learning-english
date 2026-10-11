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
