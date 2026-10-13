import { expect, test } from '@playwright/test'
import { MOBILE, login } from './helpers'

// Paso 8: el pulido. No son medidas del plano, sino lo que se nota al usar la
// app de verdad: dónde estás escribiendo, los estados vacíos y que el CSS que
// promete una clase exista de verdad.

test.describe('pulido', () => {
  test('el campo de escribir de la charla se marca cuando tiene el foco', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await page.locator('.card-link').first().click()
    await page.getByRole('link', { name: 'Charlar' }).click()

    const field = page.locator('.composer-field')
    const input = page.locator('.composer-field input')
    await expect(input).toBeVisible()

    const style = () =>
      field.evaluate((element) => {
        const computed = getComputedStyle(element)
        return { width: computed.outlineWidth, style: computed.outlineStyle }
      })

    expect((await style()).style, 'sin foco no hay marco').toBe('none')

    await input.focus()
    const focused = await style()
    expect(focused.style, 'con el foco el marco se ve').toBe('solid')
    expect(focused.width, 'el marco mide 2 px').toBe('2px')
  })

  test('las clases que usan las pantallas existen en el CSS', async ({ page }) => {
    await login(page)

    // Un error corregido del resultado del test (AssessmentPage) se pinta con
    // `.correction`: si la clase desaparece del CSS, aquello queda sin caja.
    const correction = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.className = 'correction'
      document.body.appendChild(probe)
      const computed = getComputedStyle(probe)
      const result = {
        borderWidth: computed.borderTopWidth,
        borderStyle: computed.borderTopStyle,
        background: computed.backgroundColor,
      }
      probe.remove()
      return result
    })

    expect(correction.borderStyle, 'el error corregido lleva caja').toBe('solid')
    expect(correction.borderWidth, 'la caja tiene 1 px').toBe('1px')
    expect(correction.background, 'la caja tiene fondo propio').not.toBe('rgba(0, 0, 0, 0)')
  })

  test('la campana de la barra de arriba lleva a Novedades', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')

    // Antes cambiaba de pestaña sin avisar; el punto promete novedades.
    await page.locator('.topbar').getByRole('link', { name: /^Novedades/ }).click()
    await expect(page).toHaveURL(/\/novedades$/)
    await expect(page.locator('.editor-title')).toHaveText('Novedades')
  })

  test('las listas vacías explican qué hacer', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)

    // Subir sin nada subido todavía.
    await page.goto('/subir')
    await expect(page.locator('.empty')).toContainText('Todavía no has subido nada')

    // El inicio, sin resultados del buscador.
    await page.goto('/')
    await page.getByLabel('Buscar profesor').fill('zzzz-no-existe')
    await expect(page.locator('.empty')).toContainText('No encontré')
  })
})
