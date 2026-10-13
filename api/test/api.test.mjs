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
    body: options.body === undefined ? undefined : options.raw ? options.body : JSON.stringify(options.body),
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

/** Sube un archivo de verdad: FormData con el archivo y el modo. */
async function upload(formData) {
  const response = await fetch(`${BASE}/api/uploads`, {
    method: 'POST',
    headers: cookie ? { cookie } : {},
    body: formData,
  })

  const raw = await response.text()
  let data = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = raw
  }

  return { status: response.status, data }
}

function fileForm(
  content = 'Hi, this is a file for the test.',
  { type = 'text/plain', name = 'nota.txt', mode } = {},
) {
  const form = new FormData()
  form.set('file', new Blob([content], { type }), name)
  if (mode) form.set('mode', mode)
  return form
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

    it('abre la charla del personaje: una sola vez, con su saludo dentro', async () => {
      const opened = await api(`/api/characters/${created.id}/chat`)
      assert.equal(opened.status, 200)
      assert.equal(opened.data.data.character.id, created.id)
      assert.equal(opened.data.data.conversation.characterId, created.id)
      assert.equal(opened.data.data.messages.length, 1, 'la charla arranca con el saludo')
      assert.equal(opened.data.data.messages[0].role, 'assistant')
      assert.match(opened.data.data.messages[0].content, /Warm-up time/)

      // Volver a abrirla no crea otra charla: sigue la misma.
      const again = await api(`/api/characters/${created.id}/chat`)
      assert.equal(again.data.data.conversation.id, opened.data.data.conversation.id)
      assert.equal(again.data.data.messages.length, 1)
    })

    it('"otra charla" abre un historial nuevo con el mismo personaje', async () => {
      const before = await api(`/api/characters/${created.id}/chat`)
      const fresh = await api(`/api/characters/${created.id}/chat`, { method: 'POST' })
      assert.equal(fresh.status, 200)
      assert.notEqual(fresh.data.data.conversation.id, before.data.data.conversation.id)
      assert.equal(fresh.data.data.conversation.characterId, created.id)
      assert.equal(fresh.data.data.messages.length, 1)

      // Ahora la charla del personaje es la nueva.
      const reopened = await api(`/api/characters/${created.id}/chat`)
      assert.equal(reopened.data.data.conversation.id, fresh.data.data.conversation.id)
    })

    it('entrenar abre una charla aparte de la de conversar', async () => {
      const chat = await api(`/api/characters/${created.id}/chat`)
      const train = await api(`/api/characters/${created.id}/chat?mode=train`)

      assert.equal(train.status, 200)
      assert.equal(train.data.data.conversation.mode, 'train')
      assert.equal(train.data.data.conversation.title, 'Entrenamiento con Personaje editado')
      assert.equal(chat.data.data.conversation.mode, 'chat')
      assert.notEqual(
        train.data.data.conversation.id,
        chat.data.data.conversation.id,
        'entrenar y charlar no comparten historial',
      )

      // Cada modo reabre su propia charla, no la del otro.
      const trainAgain = await api(`/api/characters/${created.id}/chat?mode=train`)
      assert.equal(trainAgain.data.data.conversation.id, train.data.data.conversation.id)
      const chatAgain = await api(`/api/characters/${created.id}/chat`)
      assert.equal(chatAgain.data.data.conversation.id, chat.data.data.conversation.id)

      // Y la lista de charlas dice de qué modo es cada una.
      const list = await api('/api/conversations')
      const inList = list.data.find((entry) => entry.id === train.data.data.conversation.id)
      assert.equal(inList.mode, 'train')
    })

    it('no deja abrir la charla de un personaje que no es tuyo', async () => {
      const missing = await api('/api/characters/no-existe/chat')
      assert.equal(missing.status, 404)
      assert.equal(missing.data.error, 'not_found')

      const fresh = await api('/api/characters/no-existe/chat', { method: 'POST' })
      assert.equal(fresh.status, 404)
    })

    it('crear una charla con characterId la deja atada al personaje', async () => {
      const created_ = await api('/api/conversations', {
        method: 'POST',
        body: { characterId: created.id },
      })
      assert.equal(created_.status, 200)
      assert.equal(created_.data.characterId, created.id)

      const list = await api('/api/conversations')
      const found = list.data.find((conversation) => conversation.id === created_.data.id)
      assert.ok(found, 'la charla nueva debería aparecer en la lista')
      assert.equal(found.characterId, created.id)
    })

    it('rechaza el cuerpo vacío solo cuando es JSON inválido', async () => {
      const bad = await api('/api/conversations', { method: 'POST', body: '{', raw: true })
      assert.equal(bad.status, 400)
      assert.equal(bad.data.error, 'invalid_json')
    })
  })

  describe('archivos para transcribir o traducir', () => {
    let saved = null

    it('sube un archivo y guarda la transcripción con su traducción', async () => {
      const response = await upload(fileForm('Hello, this is my recording.'))
      assert.equal(response.status, 201)
      assert.equal(response.data.data.fileName, 'nota.txt')
      assert.equal(response.data.data.mimeType, 'text/plain')
      assert.equal(response.data.data.mode, 'translate')
      assert.ok(response.data.data.result.transcript.length > 0)
      assert.ok(response.data.data.result.translation, 'el modo traducir debería traer traducción')
      saved = response.data.data
    })

    it('solo transcribe cuando se pide así', async () => {
      const response = await upload(fileForm('Hello again.', { mode: 'transcribe' }))
      assert.equal(response.status, 201)
      assert.equal(response.data.data.mode, 'transcribe')
      assert.equal(response.data.data.result.translation, null)
    })

    it('rechaza un tipo de archivo que no puede leer', async () => {
      const response = await upload(fileForm('PK', { type: 'application/zip', name: 'cosas.zip' }))
      assert.equal(response.status, 415)
      assert.equal(response.data.error, 'unsupported_type')
    })

    it('rechaza una subida sin archivo', async () => {
      const form = new FormData()
      form.set('mode', 'translate')
      const response = await upload(form)
      assert.equal(response.status, 400)
      assert.equal(response.data.error, 'missing_file')
    })

    it('rechaza un archivo más pesado de lo que acepta el plan gratis', async () => {
      const big = new Blob([new Uint8Array(12 * 1024 * 1024 + 1)], { type: 'audio/mpeg' })
      const form = new FormData()
      form.set('file', big, 'largo.mp3')
      const response = await upload(form)
      assert.equal(response.status, 413)
      assert.equal(response.data.error, 'file_too_big')
    })

    it('lista el historial, lo lee y lo borra', async () => {
      const list = await api('/api/uploads')
      assert.equal(list.status, 200)
      assert.ok(list.data.data.some((item) => item.id === saved.id))

      const one = await api(`/api/uploads/${saved.id}`)
      assert.equal(one.status, 200)
      assert.equal(one.data.data.id, saved.id)

      const removed = await api(`/api/uploads/${saved.id}`, { method: 'DELETE' })
      assert.equal(removed.status, 200)

      const gone = await api(`/api/uploads/${saved.id}`)
      assert.equal(gone.status, 404)
      assert.equal(gone.data.error, 'not_found')
    })
  })

  it('frena las llamadas de IA al llegar al tope del día', async () => {
    const created = await api('/api/conversations', { method: 'POST' })
    assert.equal(created.status, 200)
    const conversationId = created.data.id

    // Las pruebas de arriba ya gastaron parte del tope: se empuja hasta que la
    // API diga basta, y se comprueba que el freno es firme.
    let blocked = null
    for (let i = 0; i <= AI_DAILY_LIMIT + 1 && blocked === null; i += 1) {
      const sent = await api(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { content: 'Hello teacher, this is a test message.' },
      })
      if (sent.status === 429) blocked = sent
      else assert.equal(sent.status, 200)
    }

    assert.ok(blocked, 'la IA nunca frenó al llegar al tope del día')
    assert.equal(blocked.data.error, 'ai_daily_limit')
    assert.match(blocked.data.message, /llamadas de IA/)
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
