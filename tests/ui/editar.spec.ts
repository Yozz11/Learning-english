import { expect, test } from '@playwright/test'
import { MOBILE, box, expectClose, expectNoHorizontalScroll, login } from './helpers'

// El editor de la ficha del personaje. El plano no trae esta pantalla, así que
// aquí se comprueba lo que sí es verificable: que edita de verdad la ficha que
// usa la charla, y que ya no crea personajes (eso se hace cargando un archivo).

test.describe('editar la ficha de un personaje', () => {
  test('se entra desde la ficha y el editor escribe en ella', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')

    const name = (await page.locator('.card .name').first().innerText()).trim()
    await page.locator('.card').first().click()
    await page.getByRole('link', { name: 'Editar' }).click()

    await expect(page).toHaveURL(/\/editar\/[0-9a-f-]+$/)
    await expect(page.locator('.editor-title')).toHaveText('Editar personaje')

    // La cara del avance es cuadrada, como la de la ficha.
    const face = await box(page, '.editor-face')
    expectClose(face.height, face.width, 'la cara del avance es cuadrada')

    await page.getByRole('textbox', { name: /^Frase/ }).fill('Frase cambiada por la prueba.')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.locator('.editor-head')).toContainText('guardado')

    // Y se ve al volver al inicio, en la tarjeta de ese mismo personaje.
    await page.goto('/')
    await expect(page.locator('.card', { hasText: name })).toContainText('Frase cambiada por la prueba.')

    await expectNoHorizontalScroll(page, MOBILE.width)
  })

  test('sin nombre no guarda y lo dice', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await page.locator('.card').first().click()
    await page.getByRole('link', { name: 'Editar' }).click()

    await page.getByRole('textbox', { name: /^Nombre/ }).fill('')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()

    await expect(page.locator('.alert')).toContainText('Ponle un nombre')
  })

  test('/profesor ya no existe: lleva al inicio', async ({ page }) => {
    await login(page)
    await page.goto('/profesor')
    await expect(page).toHaveURL(/\/$/)
  })
})
