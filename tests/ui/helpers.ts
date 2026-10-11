import { expect, type BrowserContext, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEST_PASSPHRASE } from '../config.mjs'

// Ayudas comunes de las pruebas de interfaz. Todo se comprueba leyendo el DOM y
// los estilos calculados: nunca comparando capturas a ojo.

export const MOBILE = { width: 390, height: 844 }
export const DESKTOP = { width: 1280, height: 800 }

/** La referencia de la interfaz (no es parte de la app, vive fuera de git). */
const rootDir = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))
export const REFERENCE_URL = `file://${path.join(rootDir, 'docs', 'referencia', 'referencia-ui.html')}`

export type Box = {
  width: number
  height: number
  top: number
  left: number
  right: number
  bottom: number
  display: string
  position: string
  borderRadius: string
  columnGap: string
  rowGap: string
  columns: number
  color: string
  background: string
}

/** Medidas y estilos calculados del primer elemento que coincide. */
export async function box(page: Page, selector: string, index = 0): Promise<Box> {
  return page.locator(selector).nth(index).evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      display: style.display,
      position: style.position,
      borderRadius: style.borderRadius,
      columnGap: style.columnGap,
      rowGap: style.rowGap,
      columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
      color: style.color,
      background: style.backgroundColor,
    }
  })
}

/** Las mismas medidas, pero del plano. Se abre en otra pestaña y se cierra. */
export async function referenceBox(
  context: BrowserContext,
  selector: string,
  index = 0,
  viewport = MOBILE,
): Promise<Box> {
  const page = await context.newPage()
  await page.setViewportSize(viewport)
  await page.goto(REFERENCE_URL)
  const measured = await box(page, selector, index)
  await page.close()
  return measured
}

/** Dos medidas tienen que coincidir dentro del margen acordado (1 px). */
export function expectClose(actual: number, expected: number, what: string, tolerance = 1) {
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected} del plano`).toBeLessThanOrEqual(
    tolerance,
  )
}

/** Entra con la contraseña de pruebas y espera a estar dentro. */
export async function login(page: Page, passphrase: string = TEST_PASSPHRASE) {
  await page.setViewportSize(MOBILE)
  await page.goto('/login')
  await page.getByLabel('Contraseña').fill(passphrase)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('navigation', { name: 'Secciones' }).first()).toBeVisible()
}

/** Número de columnas que pinta una cuadrícula. */
export async function gridColumns(page: Page, selector: string): Promise<number> {
  return (await box(page, selector)).columns
}

/** Nada debe desbordar a lo ancho: es la causa número uno de scroll horizontal. */
export async function expectNoHorizontalScroll(page: Page, width: number) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(overflow.document, 'el documento no debe pasar del ancho de la pantalla').toBeLessThanOrEqual(
    width + 1,
  )
}
