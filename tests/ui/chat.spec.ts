import { expect, test } from '@playwright/test'
import { DESKTOP, MOBILE, box, expectClose, expectNoHorizontalScroll, login, referenceBox } from './helpers'

// Paso 5 del plano: la charla de un personaje. Las medidas salen del marco 3
// (móvil) y del 5 (PC). El envío usa el proveedor `mock`: no gasta cuota.

/** Entra a la charla del primer personaje de la biblioteca y devuelve su nombre. */
async function openCharacterChat(page: import('@playwright/test').Page) {
  await page.goto('/')
  const name = (await page.locator('.card .name').first().innerText()).trim()
  await page.locator('.card').first().click()
  await page.getByRole('link', { name: 'Chatear' }).click()
  await expect(page.locator('.chat-head')).toBeVisible()
  return name
}

test.describe('charla con un personaje', () => {
  test('el chat del móvil es el del plano', async ({ page, context }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    const name = await openCharacterChat(page)

    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]+$/)
    await expect(page.locator('.chat-nm')).toHaveText(name)

    // La cabecera: cara de 44, nombre de 20 y el alto del plano.
    const head = await box(page, '.chat-head')
    const headReference = await referenceBox(context, '.phone .chat-head')
    expectClose(head.height, headReference.height, 'alto de la cabecera del chat')

    const face = await box(page, '.chat-face')
    expectClose(face.width, 44, 'ancho de la cara (44 px del plano)')
    expectClose(face.width, face.height, 'la cara es cuadrada')
    expect(face.borderRadius, 'la cara lleva esquinas, no es un cuadrado pelado').not.toBe('0px')

    const nameReference = await referenceBox(context, '.phone .chat-head .nm')
    const nm = await box(page, '.chat-nm')
    expect(nm.fontSize, 'tamaño del nombre del personaje').toBe(nameReference.fontSize)

    // Los mensajes: el del personaje y el tuyo, con la forma del plano.
    const bot = await box(page, '.msg-bot')
    const botReference = await referenceBox(context, '.phone .bot')
    expect(bot.fontSize, 'tamaño del texto del personaje').toBe(botReference.fontSize)
    expect(bot.borderRadius, 'redondeo del mensaje del personaje').toBe(botReference.borderRadius)

    // La caja de escribir, pegada abajo y sin tapar los mensajes.
    const field = await box(page, '.composer-field')
    const fieldReference = await referenceBox(context, '.phone .composer .field')
    expectClose(field.height, fieldReference.height, 'alto de la caja de escribir')
    expectClose(field.height, 56, 'alto de la caja de escribir (56 px del plano)')
    expect(field.borderRadius, 'la caja es una píldora').toBe(fieldReference.borderRadius)

    const composer = await box(page, '.chat-composer')
    expectClose(composer.bottom, MOBILE.height, 'el compositor llega al borde de abajo')
    const msgs = await box(page, '.chat-msgs')
    expect(msgs.bottom, 'los mensajes no se meten debajo del compositor').toBeLessThanOrEqual(
      composer.top + 1,
    )

    const disclaimer = await box(page, '.disclaimer')
    expect(disclaimer.display, 'el aviso de que es una IA').not.toBe('none')

    // En el móvil el panel del personaje no se ve.
    await expect(page.locator('.chat-panel')).toBeHidden()

    await expectNoHorizontalScroll(page, MOBILE.width)
  })

  test('el personaje contesta, corrige y sigue la charla', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    const name = await openCharacterChat(page)

    // La charla arranca con el saludo del personaje.
    await expect(page.locator('.msg-bot')).toHaveCount(1)

    await page.getByLabel('Mensaje').fill('Yesterday I go to the gym.')
    await page.getByRole('button', { name: 'Enviar' }).click()

    await expect(page.locator('.msg-me')).toHaveText('Yesterday I go to the gym.')
    await expect(page.locator('.msg-bot')).toHaveCount(2)

    // La corrección va aparte, con la forma correcta delante.
    const fix = page.locator('.fix').first()
    await expect(fix).toBeVisible()
    await expect(fix).toContainText('Mejor:')

    // El personaje llegó al prompt: la respuesta de prueba lo deja por escrito.
    await expect(page.locator('.msg-bot').nth(1)).toContainText(name)

    // "Otra charla" empieza de cero con el mismo personaje.
    await page.getByRole('button', { name: 'Otra charla' }).click()
    await expect(page.locator('.msg-me')).toHaveCount(0)
    await expect(page.locator('.msg-bot')).toHaveCount(1)
    await expect(page.locator('.chat-nm')).toHaveText(name)
  })

  test('en el escritorio, el panel del personaje va a la derecha', async ({ page, context }) => {
    await login(page)
    await page.setViewportSize(DESKTOP)
    // El botón "Chats" lleva al último personaje que usaste.
    await page.getByRole('link', { name: 'Chats' }).click()
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]+$/)

    const panel = await box(page, '.chat-panel')
    const panelReference = await referenceBox(context, '.desk .panel', 0, DESKTOP)
    expect(panel.display, 'el panel se ve en el escritorio').not.toBe('none')
    expectClose(panel.width, 320, 'ancho del panel (320 px del plano)')
    expectClose(panel.width, panelReference.width, 'ancho del panel del plano')

    const face = await box(page, '.chat-face')
    expectClose(face.width, 44, 'cara de la cabecera')

    await expect(page.locator('.chat-panel')).toContainText('Tu nivel')
    await expect(page.locator('.chat-panel')).toContainText('Errores recientes')
    await expect(page.locator('.panel-face')).toBeVisible()

    // En la columna, los mensajes no pasan de 820 px.
    const col = await box(page, '.chat-col')
    expect(col.width, 'la columna del chat no se estira de más').toBeLessThanOrEqual(821)

    // Y la cabecera va dentro de esa misma columna, no a todo lo ancho.
    const head = await box(page, '.chat-head')
    expectClose(head.width, col.width, 'la cabecera va dentro de la columna del plano')
    expect(head.width, 'la cabecera no se estira a todo el ancho').toBeLessThan(DESKTOP.width - 320)

    // El panel arranca arriba y llega hasta abajo, como en el plano.
    const chat = await box(page, '.chat')
    expectClose(panel.top, chat.top, 'el panel del plano arranca arriba')
    expectClose(panel.height, chat.height, 'el panel del plano ocupa toda la altura')

    await expectNoHorizontalScroll(page, DESKTOP.width)
  })
})
