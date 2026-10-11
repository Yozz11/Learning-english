import { expect, test } from '@playwright/test'
import { DESKTOP, MOBILE, box, expectClose, expectNoHorizontalScroll, login, referenceBox } from './helpers'

// Paso 1 del plano: tema, estructura base (móvil y escritorio) y navegación.

test.describe('estructura base', () => {
  test('la barra inferior del móvil es la del plano', async ({ page, context }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')

    const reference = await referenceBox(context, '.phone .bottom-nav')
    const nav = await box(page, '.bottom-nav')

    expectClose(nav.height, reference.height, 'alto de la barra inferior')
    expectClose(nav.height, 84, 'alto de la barra inferior (84 px del plano)')
    expect(nav.position, 'la barra inferior va fija').toBe('fixed')
    expectClose(nav.bottom, MOBILE.height, 'la barra llega al borde de abajo')

    const items = page.locator('.bottom-nav .nav-item')
    const total = await items.count()
    expect(total, 'como máximo 6 iconos en la barra inferior').toBeLessThanOrEqual(6)
    expect(total, 'los que ya existen hoy').toBeGreaterThanOrEqual(4)

    for (let index = 0; index < total; index += 1) {
      const item = await box(page, '.bottom-nav .nav-item', index)
      expect(Math.min(item.width, item.height), `el icono ${index} debe llegar a 44 px`).toBeGreaterThanOrEqual(44)
    }

    // En el móvil la barra lateral no se ve.
    await expect(page.locator('.sidebar')).toBeHidden()
    await expectNoHorizontalScroll(page, MOBILE.width)
  })

  test('la barra lateral del escritorio es la del plano', async ({ page, context }) => {
    await login(page)
    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    const reference = await referenceBox(context, '.desk .sidebar', 0, DESKTOP)
    const sidebar = await box(page, '.sidebar')

    expectClose(sidebar.width, reference.width, 'ancho de la barra lateral')
    expectClose(sidebar.width, 240, 'ancho de la barra lateral (240 px del plano)')
    expect(sidebar.display, 'en el escritorio la barra lateral se ve').toBe('flex')

    // La marca del plano: la palabra sola, grande (28 px), sin bajada de texto.
    const brand = await box(page, '.sidebar .brand')
    const brandReference = await referenceBox(context, '.desk .sidebar .brand', 0, DESKTOP)
    expect(brand.fontSize, 'tamaño de la marca del plano').toBe(brandReference.fontSize)
    expect(brand.fontSize, 'la marca del plano mide 28 px').toBe('28px')
    await expect(page.locator('.sidebar .brand')).toHaveText('english')

    await expect(page.locator('.bottom-nav')).toBeHidden()
    await expectNoHorizontalScroll(page, DESKTOP.width)
  })

  test('los iconos de la barra llevan a sus pantallas', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)

    // La charla ocupa toda la pantalla y esconde la barra, así que volvemos a
    // inicio antes de probar el siguiente icono.
    const routes: [string, RegExp][] = [
      ['Chats', /\/chat$/],
      ['Subir', /\/subir$/],
      ['Curso', /\/test$/],
      ['Perfil', /\/perfil$/],
      ['Inicio', /\/$/],
    ]

    for (const [label, url] of routes) {
      await page.goto('/')
      await page.locator('.bottom-nav').getByRole('link', { name: label }).click()
      await expect(page).toHaveURL(url)
    }

    await expect(page.locator('.bottom-nav .nav-item.active')).toHaveCount(1)
  })
})
