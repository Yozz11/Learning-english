import { expect, test } from '@playwright/test'
import { MOBILE, box, expectNoHorizontalScroll, login } from './helpers'

// Música de fondo: botón flotante que enciende y apaga el jazz bajito.

test.describe('música de fondo', () => {
  test('el mp3 de jazz se sirve', async ({ page }) => {
    const response = await page.request.get('/audio/jazz-fondo.mp3')
    expect(response.status(), 'el archivo de música debe existir').toBe(200)
  })

  test('el botón flota encima de la barra inferior y enciende/apaga', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')

    const button = page.locator('.jazz-btn')
    await expect(button).toBeVisible()
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    // No debe tapar la barra inferior: queda por encima de ella.
    const jazz = await box(page, '.jazz-btn')
    const nav = await box(page, '.bottom-nav')
    expect(jazz.bottom, 'el botón de música no se encima en la barra').toBeLessThanOrEqual(nav.top + 1)

    // Un toque la enciende, otro la apaga.
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    await expectNoHorizontalScroll(page, MOBILE.width)
  })

  test('el botón también está en el chat a pantalla completa', async ({ page }) => {
    await login(page)
    await page.goto('/')
    await page.locator('.bottom-nav').getByRole('link', { name: 'Chats' }).click()
    await expect(page).toHaveURL(/\/chat$/)
    await expect(page.locator('.jazz-btn')).toBeVisible()
  })
})