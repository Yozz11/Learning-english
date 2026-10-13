import { expect, test } from '@playwright/test'
import { MOBILE, box, expectClose, expectNoHorizontalScroll, login } from './helpers'

// Paso 4 del plano: la ficha del personaje. Lo que se ve aquí es lo que de
// verdad entra en el prompt, no un resumen decorativo.

test.describe('ficha del personaje', () => {
  test('enseña quién es, cómo habla y cómo corrige', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')

    const name = (await page.locator('.card .name').first().innerText()).trim()
    const tagline = (await page.locator('.card .tag').first().innerText()).trim()
    await page.locator('.card-link').first().click()

    await expect(page).toHaveURL(/\/personaje\//)
    await expect(page.locator('.ficha-name')).toHaveText(name)
    await expect(page.locator('.ficha-tagline')).toContainText(tagline.slice(0, 20))

    // La cara grande es cuadrada.
    const image = await box(page, '.ficha-img')
    expectClose(image.height, image.width, 'la cara de la ficha es cuadrada')
    expect(image.borderRadius, 'esquinas de la cara').not.toBe('0px')

    // Los datos que usa el chat: cómo es, cómo habla y cómo abre la charla.
    await expect(page.locator('.kv-k', { hasText: 'Cómo es' })).toBeVisible()
    await expect(page.locator('.kv-k', { hasText: 'Cómo habla' })).toBeVisible()
    await expect(page.locator('.kv-k', { hasText: 'Cómo abre la charla' })).toBeVisible()
    expect(await page.locator('.kv').count(), 'al menos tres apartados').toBeGreaterThanOrEqual(3)

    // Los límites que ya existían siguen dichos en la ficha.
    await expect(page.locator('.chips')).toContainText('Corrige')
    await expect(page.locator('.chips')).toContainText('Español')

    // Las dos formas de entrar con este profesor: entrenar (práctica) o charlar.
    await expect(page.getByRole('link', { name: 'Entrenar' })).toHaveAttribute(
      'href',
      /\/entrenar\/[0-9a-f-]+$/,
    )
    await expect(page.getByRole('link', { name: 'Charlar' })).toHaveAttribute(
      'href',
      /\/chat\/[0-9a-f-]+$/,
    )

    await expectNoHorizontalScroll(page, MOBILE.width)
  })

  test('seguir a un personaje lo deja en la pestaña Siguiendo', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')

    const name = (await page.locator('.card .name').first().innerText()).trim()
    await page.locator('.card-link').first().click()

    const follow = page.getByRole('button', { name: /^(Seguir|Siguiendo)$/ })
    await expect(follow).toHaveAttribute('aria-pressed', 'false')
    await follow.click()
    await expect(follow).toHaveAttribute('aria-pressed', 'true')
    await expect(follow).toHaveText('Siguiendo')

    await page.getByRole('link', { name: 'Volver' }).click()
    await page.getByRole('tab', { name: 'Siguiendo' }).click()
    await expect(page.locator('.card .name')).toHaveText(name)

    // Se deja como estaba para no ensuciar el resto de las pruebas.
    await page.getByRole('tab', { name: 'Para ti' }).click()
    await page.locator('.card-link').first().click()
    await follow.click()
    await expect(follow).toHaveAttribute('aria-pressed', 'false')
  })
})
