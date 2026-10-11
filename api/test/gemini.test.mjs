// Pruebas del proveedor de Gemini de verdad, pero con Gemini de mentira.
//
// Todas las demás pruebas usan el proveedor `mock`, así que el código que corre
// en producción (reintentos, cuota, archivos pegados al mensaje) no se probaba.
// Aquí se levanta un servidor local que finge ser Gemini y se apunta el Worker
// con GEMINI_BASE_URL: así se puede pedir un 503 a voluntad y ver si reintenta.
//
// No gasta cuota: el Worker nunca sale a internet.

import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdirSync, openSync, rmSync } from 'node:fs'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const apiDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const stateDir = path.join(apiDir, '.wrangler', 'gemini-state')
const logFile = path.join(apiDir, '.wrangler', 'gemini-dev.log')

const PORT = 8800
const BASE = `http://127.0.0.1:${PORT}`
const PASSPHRASE = 'passphrase-de-pruebas'

let server = null
let fake = null
let cookie = ''

/** Respuestas que dará el Gemini de mentira, una por llamada. */
let script = []
/** Todo lo que recibió el Gemini de mentira, para poder mirarlo. */
let received = []

const BUSY = {
  status: 503,
  body: {
    error: {
      message: 'This model is currently experiencing high demand.',
      status: 'UNAVAILABLE',
    },
  },
}

function answer(text) {
  return { status: 200, body: { candidates: [{ content: { parts: [{ text }] } }] } }
}

/** Levanta el Gemini de mentira en un puerto libre. */
function startFakeGemini() {
  const http = createServer((request, response) => {
    let raw = ''
    request.on('data', (chunk) => {
      raw += chunk
    })
    request.on('end', () => {
      let body = {}
      try {
        body = JSON.parse(raw || '{}')
      } catch {
        // Si llegara algo raro, se guarda igual para poder mirarlo.
      }
      received.push({ url: request.url, body })

      const step = script.shift() ?? answer('respuesta de relleno')
      response.writeHead(step.status, { 'content-type': 'application/json' })
      response.end(JSON.stringify(step.body))
    })
  })

  return new Promise((resolve) => {
    http.listen(0, '127.0.0.1', () => {
      resolve({ http, port: http.address().port })
    })
  })
}

function wrangler(args) {
  return spawnSync('npx', ['--no-install', 'wrangler', ...args], { cwd: apiDir, encoding: 'utf8' })
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

async function login() {
  const response = await api('/api/auth/login', { method: 'POST', body: { passphrase: PASSPHRASE } })
  const setCookie = response.headers.getSetCookie?.() ?? []
  if (setCookie.length > 0) cookie = setCookie[0].split(';')[0]
  return response
}

/** Un personaje propio para la charla, con su saludo (que no gasta IA). */
async function characterId() {
  const list = await api('/api/characters')
  assert.equal(list.status, 200)
  assert.ok(list.data.data.length > 0, 'la biblioteca debería estrenarse sola')
  return list.data.data[0].id
}

before(async () => {
  rmSync(stateDir, { recursive: true, force: true })
  mkdirSync(stateDir, { recursive: true })

  const migrated = wrangler(['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', stateDir])
  if (migrated.status !== 0) {
    throw new Error(`No pude preparar la base de Gemini:\n${migrated.stdout}\n${migrated.stderr}`)
  }

  fake = await startFakeGemini()

  const log = openSync(logFile, 'w')
  server = spawn(
    'npx',
    [
      '--no-install',
      'wrangler',
      'dev',
      '--port',
      String(PORT),
      // Cada wrangler dev ocupa un puerto de inspección: sin esto choca con el
      // otro servidor de pruebas cuando las dos suites corren a la vez.
      '--inspector-port',
      '9230',
      '--persist-to',
      stateDir,
      '--var',
      'AI_PROVIDER:gemini',
      '--var',
      'GEMINI_API_KEY:clave-de-pruebas',
      '--var',
      'GEMINI_MODEL:gemini-de-pruebas',
      '--var',
      `GEMINI_BASE_URL:http://127.0.0.1:${fake.port}`,
      '--var',
      'AI_DAILY_LIMIT:200',
      '--var',
      `APP_PASSPHRASE:${PASSPHRASE}`,
      '--var',
      'SESSION_SECRET:secreto-de-pruebas',
    ],
    { cwd: apiDir, stdio: ['ignore', log, log] },
  )

  await waitForServer(server)
})

after(async () => {
  if (server) server.kill('SIGTERM')
  if (fake) fake.http.close()
})

describe('proveedor Gemini (con un Gemini de mentira)', () => {
  it('el chequeo de salud dice que el proveedor es gemini', async () => {
    const response = await api('/api/health')
    assert.equal(response.status, 200)
    assert.equal(response.data.provider, 'gemini')
    assert.equal(response.data.model, 'gemini-de-pruebas')

    const session = await login()
    assert.equal(session.status, 200, 'la contraseña de pruebas debe entrar')
  })

  it('habla con la dirección de Gemini que le digan', async () => {
    received = []
    const character = await characterId()
    const chat = await api(`/api/characters/${character}/chat`)
    assert.equal(chat.status, 200)

    script = [answer('Hola, soy el Gemini de mentira.')]
    const response = await api(`/api/conversations/${chat.data.data.conversation.id}/messages`, {
      method: 'POST',
      body: { content: 'Hello there.' },
    })

    assert.equal(response.status, 200)
    assert.equal(response.data.reply.content, 'Hola, soy el Gemini de mentira.')

    assert.equal(received.length, 1)
    assert.equal(received[0].url, '/v1beta/models/gemini-de-pruebas:generateContent')
    // El personaje viaja como instrucción de sistema y el mensaje como contenido.
    assert.match(received[0].body.systemInstruction.parts[0].text, /English|teacher|character|profesor/i)
    assert.equal(received[0].body.contents.at(-1).parts[0].text, 'Hello there.')
  })

  it('reintenta solo cuando Gemini está saturado y contesta al final', async () => {
    const character = await characterId()
    const chat = await api(`/api/characters/${character}/chat`)

    // Dos picos de demanda y después una respuesta buena: el usuario no se entera.
    received = []
    script = [BUSY, BUSY, answer('Ya me desaturo.')]
    const response = await api(`/api/conversations/${chat.data.data.conversation.id}/messages`, {
      method: 'POST',
      body: { content: 'Are you there?' },
    })

    assert.equal(response.status, 200)
    assert.equal(response.data.reply.content, 'Ya me desaturo.')
    assert.equal(received.length, 3, 'debe reintentar hasta que le contesten')
  })

  it('si sigue saturado, se rinde con un mensaje claro y sin marear a Gemini', async () => {
    const character = await characterId()
    const chat = await api(`/api/characters/${character}/chat`)

    received = []
    script = [BUSY, BUSY, BUSY, BUSY, BUSY]
    const response = await api(`/api/conversations/${chat.data.data.conversation.id}/messages`, {
      method: 'POST',
      body: { content: 'One more time.' },
    })

    assert.equal(response.status, 503)
    assert.equal(response.data.error, 'ai_busy')
    assert.match(response.data.message, /saturado/i)
    assert.equal(received.length, 3, 'no reintenta sin fin')
  })

  it('la cuota agotada no se reintenta y se explica en español', async () => {
    const character = await characterId()
    const chat = await api(`/api/characters/${character}/chat`)

    received = []
    script = [
      { status: 429, body: { error: { message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } } },
      answer('No debería llegar aquí.'),
    ]
    const response = await api(`/api/conversations/${chat.data.data.conversation.id}/messages`, {
      method: 'POST',
      body: { content: 'Hello?' },
    })

    assert.equal(response.status, 429)
    assert.equal(response.data.error, 'ai_quota_exhausted')
    assert.match(response.data.message, /cuota/i)
    assert.equal(received.length, 1, 'esperar aquí no arregla nada')
  })

  it('manda el archivo pegado al mensaje y devuelve el texto que trae', async () => {
    received = []
    script = [
      answer(
        JSON.stringify({
          title: 'Archivo de prueba',
          transcript: 'Hello, this is what the file says.',
          translation: 'Hola, esto es lo que dice el archivo.',
          notes: ['"file": archivo.'],
        }),
      ),
    ]

    const form = new FormData()
    form.set('file', new Blob(['datos falsos'], { type: 'image/png' }), 'clase.png')
    form.set('mode', 'translate')

    const response = await fetch(`${BASE}/api/uploads`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    })
    const data = await response.json()

    assert.equal(response.status, 201)
    assert.equal(data.data.result.transcript, 'Hello, this is what the file says.')
    assert.equal(data.data.result.translation, 'Hola, esto es lo que dice el archivo.')

    // El archivo va como datos pegados (inlineData), no como URL ni nada raro.
    const parts = received[0].body.contents.at(-1).parts
    const attached = parts.find((part) => part.inlineData)
    assert.ok(attached, 'el archivo debería ir dentro del mensaje')
    assert.equal(attached.inlineData.mimeType, 'image/png')
    assert.equal(Buffer.from(attached.inlineData.data, 'base64').toString(), 'datos falsos')
  })
})
