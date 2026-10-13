import { expect, test } from '@playwright/test'
import { MOBILE, box, expectClose, login, referenceBox } from './helpers'

// Paso 2 del plano: bienvenida con las órbitas y la pantalla de entrar.
// Las medidas se comparan con el frame 1 de la referencia, no a ojo.

test.describe('bienvenida y entrar', () => {
  test('sin sesión, la app abre en la bienvenida', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/')

    await expect(page).toHaveURL(/\/bienvenida$/)
    await expect(
      page.getByRole('heading', { name: 'Aprende inglés con tu profesor' }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
  })

  test('el título y el botón son los del plano', async ({ page, context }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/bienvenida')

    const referenceTitle = await referenceBox(context, '.welcome h1')
    const title = await box(page, '.welcome h1')
    expect(title.fontSize, 'tamaño del título').toBe(referenceTitle.fontSize)
    expect(title.textAlign, 'el título va centrado').toBe('center')
    expect(title.cssTop, 'altura del título dentro de la pantalla').toBe(referenceTitle.cssTop)

    const referenceButton = await referenceBox(context, '.sheet .btn-primary')
    const button = await box(page, '.sheet .btn-primary')
    expectClose(button.height, referenceButton.height, 'alto del botón')
    expectClose(button.height, 56, 'alto del botón (56 px del plano)')
    expect(button.borderRadius, 'el botón es una píldora').toBe(referenceButton.borderRadius)
    expect(button.background, 'el botón es claro').toBe(referenceButton.background)
    expect(button.color, 'el texto del botón es oscuro').toBe(referenceButton.color)
    expect(button.fontSize, 'tamaño del texto del botón').toBe(referenceButton.fontSize)
  })

  test('la hoja de abajo es la del plano y no tapa nada raro', async ({ page, context }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/bienvenida')

    const reference = await referenceBox(context, '.sheet')
    const sheet = await box(page, '.sheet')
    expect(sheet.background, 'color de la hoja').toBe(reference.background)
    expect(sheet.borderRadius, 'las esquinas de arriba van redondeadas').toBe(reference.borderRadius)
    expectClose(sheet.bottom, MOBILE.height, 'la hoja llega al borde de abajo')

    // Las tres órbitas con sus dibujos.
    await expect(page.locator('.avatar-orb')).toHaveCount(3)
  })

  test('con "reducir movimiento" las órbitas se quedan quietas', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize(MOBILE)
    await page.goto('/bienvenida')

    const spin = await box(page, '.orbit-spin')
    const seconds = Number.parseFloat(spin.animationDuration)
    expect(seconds, 'la animación queda anulada').toBeLessThan(1)
  })

  test('el botón lleva a la contraseña y se entra', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/bienvenida')
    await page.getByRole('link', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(/\/login$/)
    await page.getByLabel('Contraseña').fill('no-es-la-buena')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)

    await login(page)
    await expect(page).toHaveURL(/\/$/)
  })
})
