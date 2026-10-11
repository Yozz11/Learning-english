import { expect, test } from '@playwright/test'
import { MOBILE, expectNoHorizontalScroll, login } from './helpers'

// La pantalla "Subir": mandar un archivo y recibir su texto. Corre con el
// proveedor `mock`, así que el texto es fijo: lo que se comprueba es que el
// archivo viaja, que el modo manda y que el historial guarda y borra.

function file(name: string, content: string, mimeType = 'text/plain') {
  return { name, mimeType, buffer: Buffer.from(content, 'utf8') }
}

test.describe('subir un archivo para transcribir o traducir', () => {
  test('el icono Subir abre la pantalla y el archivo deja su texto', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)

    await page.locator('.bottom-nav').getByRole('link', { name: 'Subir' }).click()
    await expect(page).toHaveURL(/\/subir$/)
    await expect(page.locator('.editor-title')).toHaveText('Subir')

    await page.locator('input[type=file]').setInputFiles(file('nota.txt', 'Hello, this is my file.'))

    // Modo por defecto: transcripción y traducción.
    await expect(page.locator('.resultado')).toHaveCount(2)
    await expect(page.locator('.resultado').first()).toContainText('fixed transcript')
    await expect(page.locator('.notas li')).toHaveCount(1)

    const item = page.locator('.upload-item').first()
    await expect(item).toContainText('nota.txt')
    await expect(item).toContainText('Prueba: nota.txt')

    await expectNoHorizontalScroll(page, MOBILE.width)
  })

  test('solo transcribir: sin traducción', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/subir')

    await page.getByRole('button', { name: 'Transcribir', exact: true }).click()
    await page.locator('input[type=file]').setInputFiles(file('solo.txt', 'Just the transcript, please.'))

    await expect(page.locator('.resultado')).toHaveCount(1)
    await expect(page.locator('.resultado').first()).toContainText('fixed transcript')
  })

  test('el historial se abre y se borra con confirmación', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/subir')

    // Vienen las subidas de las pruebas anteriores; se abre la primera.
    const item = page.locator('.upload-item').first()
    await expect(item).toBeVisible()
    await item.locator('.upload-open').click()
    await expect(page.locator('.resultado').first()).toContainText('fixed transcript')

    const before = await page.locator('.upload-item').count()

    // Borrar pregunta antes: hay que aceptar el aviso del navegador.
    page.on('dialog', (dialog) => dialog.accept())
    await item.getByRole('button', { name: 'Borrar' }).click()

    await expect(page.locator('.upload-item')).toHaveCount(before - 1)
  })
})
