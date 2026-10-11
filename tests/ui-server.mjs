// Servidor para las pruebas de interfaz.
//
// Arranca `wrangler dev` con la web ya compilada, una base D1 aparte
// (`api/.wrangler/ui-state`, ignorada por git) y el proveedor `mock`: las
// pruebas no gastan cuota de IA ni tocan datos reales.
//
// Lo lanza y lo apaga Playwright solo (webServer en playwright.config.ts).

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, openSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEST_PASSPHRASE, UI_PORT } from './config.mjs'

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const apiDir = path.join(rootDir, 'api')
const stateDir = path.join(apiDir, '.wrangler', 'ui-state')
const logFile = path.join(apiDir, '.wrangler', 'ui-server.log')

function wrangler(args) {
  return spawnSync('npx', ['--no-install', 'wrangler', ...args], { cwd: apiDir, encoding: 'utf8' })
}

rmSync(stateDir, { recursive: true, force: true })
mkdirSync(stateDir, { recursive: true })

const migrated = wrangler(['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', stateDir])
if (migrated.status !== 0) {
  console.error('No pude preparar la base de las pruebas de interfaz:')
  console.error(migrated.stdout, migrated.stderr)
  process.exit(1)
}

const log = openSync(logFile, 'w')
const server = spawn(
  'npx',
  [
    '--no-install',
    'wrangler',
    'dev',
    '--port',
    String(UI_PORT),
    '--persist-to',
    stateDir,
    '--var',
    'AI_PROVIDER:mock',
    '--var',
    'AI_DAILY_LIMIT:200',
    '--var',
    `APP_PASSPHRASE:${TEST_PASSPHRASE}`,
    '--var',
    'SESSION_SECRET:secreto-de-pruebas',
  ],
  { cwd: apiDir, stdio: ['ignore', log, log] },
)

for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(signal, () => {
    server.kill('SIGTERM')
    process.exit(0)
  })
}

server.on('exit', (code) => process.exit(code ?? 0))
