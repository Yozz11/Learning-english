import { expect, test } from '@playwright/test'
import { DESKTOP, MOBILE, box, expectNoHorizontalScroll, login } from './helpers'

// Entrenar contra charlar: al elegir un profesor se puede practicar con
// ejercicios (entrenar) o conversar (charlar). En el escritorio las dos salidas
// salen al pasar el mouse por la tarjeta; en el móvil, desde la ficha.

test.describe('entrenar o charlar con un profesor', () => {
  test('al pasar el mouse por la tarjeta salen las dos opciones', async ({ page }) => {
    await login(page)
    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    const card = page.locator('.card').first()
    const actions = page.locator('.card-actions').first()

    // Sin el mouse encima, la tarjeta está limpia.
    expect((await box(page, '.card-actions')).display, 'sin hover no se ven las acciones').toBe('none')

    await card.hover()
    await expect(actions).toBeVisible()
    await expect(actions.getByRole('link', { name: 'Entrenar' })).toHaveAttribute(
      'href',
      /\/entrenar\/[0-9a-f-]+$/,
    )
    await expect(actions.getByRole('link', { name: 'Charlar' })).toHaveAttribute(
      'href',
      /\/chat\/[0-9a-f-]+$/,
    )

    // El fondo de las acciones no se come el clic: la tarjeta sigue abriendo la ficha.
    const rect = await box(page, '.card')
    await page.mouse.click(rect.left + rect.width / 2, rect.top + 12)
    await expect(page).toHaveURL(/\/personaje\/[0-9a-f-]+$/)

    await expectNoHorizontalScroll(page, DESKTOP.width)
  })

  test('entrenar abre una sesión de práctica con ese profesor', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')

    const name = (await page.locator('.card .name').first().innerText()).trim()
    await page.locator('.card-link').first().click()
    await page.getByRole('link', { name: 'Entrenar' }).click()

    await expect(page).toHaveURL(/\/entrenar\/[0-9a-f-]+$/)
    await expect(page.locator('.chat-nm')).toHaveText(name)
    await expect(page.locator('.chat-mode')).toHaveText('Entrenando · práctica y ejercicios')

    // La sesión arranca con el saludo del profesor, como la charla.
    await expect(page.locator('.msg-bot')).toHaveCount(1)

    await expectNoHorizontalScroll(page, MOBILE.width)
  })

  test('charlar mantiene la conversación y no se mezcla con el entrenamiento', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')

    // Se entrena y se manda un mensaje en la sesión de práctica.
    await page.locator('.card-link').first().click()
    await page.getByRole('link', { name: 'Entrenar' }).click()
    await expect(page.locator('.chat-mode')).toHaveText('Entrenando · práctica y ejercicios')
    await page.getByLabel('Mensaje').fill('I am ready for the exercise.')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.locator('.msg-me')).toHaveText('I am ready for the exercise.')

    // La charla del mismo profesor es otro historial: solo trae su saludo.
    await page.goto('/')
    await page.locator('.card-link').first().click()
    await page.getByRole('link', { name: 'Charlar' }).click()
    await expect(page.locator('.chat-mode')).toHaveText('Conversación')
    await expect(page.locator('.msg-bot')).toHaveCount(1)
    await expect(page.locator('.msg-me')).toHaveCount(0)
  })
})
