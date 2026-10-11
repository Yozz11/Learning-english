import { defineConfig } from '@playwright/test'
import { UI_BASE } from './tests/config.mjs'

// Las pruebas de interfaz corren contra la app de verdad (web compilada + API)
// pero con su propia base y el proveedor `mock`: no gastan cuota de IA ni tocan
// la base de uso diario.
export default defineConfig({
  testDir: './tests/ui',
  // Todas comparten la misma base de datos: una detrás de otra.
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: UI_BASE,
    trace: 'off',
  },
  webServer: {
    command: 'npm run build --workspace web && node tests/ui-server.mjs',
    url: `${UI_BASE}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
