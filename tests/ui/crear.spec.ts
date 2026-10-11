import { expect, test } from '@playwright/test'
import { MOBILE, box, expectClose, expectNoHorizontalScroll, login } from './helpers'

// Paso 6 del plano: "Crear", el editor de la ficha del personaje. El plano no
// trae esta pantalla, así que aquí se comprueba lo que sí es verificable: que
// el editor escribe de verdad en la ficha que usa la charla.

test.describe('crear y editar un personaje', () => {
  test('el icono Crear de la barra abre el editor', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)

    await page.locator('.bottom-nav').getByRole('link', { name: 'Crear' }).click()
    await expect(page).toHaveURL(/\/crear$/)
    await expect(page.locator('.editor-title')).toHaveText('Crear personaje')

    // La cara del avance es cuadrada, como la de la ficha.
    const face = await box(page, '.editor-face')
    expectClose(face.height, face.width, 'la cara del avance es cuadrada')

    await expectNoHorizontalScroll(page, MOBILE.width)
  })

  test('/profesor ya no es un editor aparte: lleva al mismo sitio', async ({ page }) => {
    await login(page)
    await page.goto('/profesor')
    await expect(page).toHaveURL(/\/crear$/)
  })

  test('sin nombre no guarda y lo dice', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/crear')

    await page.getByRole('button', { name: 'Crear personaje' }).click()

    await expect(page.locator('.alert')).toContainText('Ponle un nombre')
    await expect(page).toHaveURL(/\/crear$/)
  })

  test('crea un personaje y aparece en el inicio', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/crear')

    await page.getByRole('textbox', { name: /^Nombre/ }).fill('Iris')
    await page.getByRole('textbox', { name: /^Cómo es/ }).fill(
      'Curiosa y preguntona: quiere saber el porqué de todo y no deja pasar una palabra rara.',
    )
    await page.getByRole('textbox', { name: /^Frase/ }).fill('Pregunta hasta que lo entiendas.')
    await page.getByRole('button', { name: 'Crear personaje' }).click()

    // Queda en modo edición del personaje que acaba de nacer.
    await expect(page).toHaveURL(/\/crear\/[0-9a-f-]+$/)
    await expect(page.locator('.editor-head')).toContainText('guardado')
    await expect(page.locator('.editor-title')).toHaveText('Editar personaje')

    await page.goto('/')
    const card = page.locator('.card', { hasText: 'Iris' })
    await expect(card.locator('.name')).toHaveText('Iris')
    await expect(card).toContainText('Pregunta hasta que lo entiendas.')

    await expectNoHorizontalScroll(page, MOBILE.width)
  })

  test('editar la ficha cambia la tarjeta del inicio', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')

    const name = (await page.locator('.card .name').first().innerText()).trim()
    await page.locator('.card').first().click()
    await page.getByRole('link', { name: 'Editar' }).click()
    await expect(page).toHaveURL(/\/crear\/[0-9a-f-]+$/)
    await expect(page.locator('.editor-title')).toHaveText('Editar personaje')

    await page.getByRole('textbox', { name: /^Frase/ }).fill('Frase cambiada por la prueba.')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.locator('.editor-head')).toContainText('guardado')

    // Y se ve al volver al inicio, en la tarjeta de ese mismo personaje.
    await page.goto('/')
    await expect(page.locator('.card', { hasText: name })).toContainText('Frase cambiada por la prueba.')
  })
})
