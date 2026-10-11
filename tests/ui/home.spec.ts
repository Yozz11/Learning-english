import { expect, test } from '@playwright/test'
import { DESKTOP, MOBILE, box, expectClose, expectNoHorizontalScroll, login, referenceBox } from './helpers'

// Paso 3 del plano: el inicio con el buscador, las cuatro pestañas y la
// cuadrícula de tarjetas de personajes.

test.describe('inicio y personajes', () => {
  test('el inicio del móvil tiene las medidas del plano', async ({ page, context }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await expect(page.locator('.card').first()).toBeVisible()
    expect(
      await page.locator('.card').count(),
      'la biblioteca arranca con los seis arquetipos inventados',
    ).toBeGreaterThanOrEqual(6)

    const searchReference = await referenceBox(context, '.phone .search')
    const search = await box(page, '.search')
    expectClose(search.height, searchReference.height, 'alto del buscador')
    expectClose(search.height, 48, 'alto del buscador (48 px del plano)')
    expect(search.borderRadius, 'el buscador es una píldora').toBe(searchReference.borderRadius)

    const tabReference = await referenceBox(context, '.phone .tab')
    const tab = await box(page, '.tab')
    expectClose(tab.height, tabReference.height, 'alto de la pestaña')
    expectClose(tab.height, 40, 'alto de la pestaña (40 px del plano)')
    expect(tab.borderRadius, 'la pestaña es una píldora').toBe(tabReference.borderRadius)

    const gridReference = await referenceBox(context, '.phone .grid')
    const grid = await box(page, '.grid')
    expect(grid.columns, 'dos columnas en el móvil').toBe(2)
    expect(grid.columns, 'las mismas columnas que el plano').toBe(gridReference.columns)

    const imageReference = await referenceBox(context, '.phone .card .img')
    const image = await box(page, '.card .img')
    expect(image.borderRadius, 'las esquinas de la imagen').toBe(imageReference.borderRadius)
    expectClose(image.height, image.width, 'la imagen es cuadrada')

    const nameReference = await referenceBox(context, '.phone .card .name')
    const name = await box(page, '.card .name')
    expect(name.fontSize, 'tamaño del nombre').toBe(nameReference.fontSize)

    const metaReference = await referenceBox(context, '.phone .card .meta')
    const meta = await box(page, '.card .meta')
    expect(meta.fontSize, 'tamaño del contador de mensajes').toBe(metaReference.fontSize)

    await expectNoHorizontalScroll(page, MOBILE.width)
  })

  test('en el escritorio la cuadrícula se abre a cinco columnas', async ({ page, context }) => {
    await login(page)
    await page.setViewportSize(DESKTOP)
    await page.goto('/')
    await expect(page.locator('.card').first()).toBeVisible()

    const reference = await referenceBox(context, '.desk .grid', 0, DESKTOP)
    const grid = await box(page, '.grid')
    expect(grid.columns, 'cinco columnas como el plano').toBe(5)
    expect(grid.columns, 'las mismas columnas que el plano').toBe(reference.columns)

    // En el escritorio el buscador se centra y la barra de arriba desaparece.
    await expect(page.locator('.topbar')).toBeHidden()
    const search = await box(page, '.search')
    expectClose(search.width, 520, 'ancho máximo del buscador')

    await expectNoHorizontalScroll(page, DESKTOP.width)
  })

  test('las pestañas filtran y la activa se marca', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await expect(page.locator('.card').first()).toBeVisible()

    const tabs = page.getByRole('tab')
    await expect(tabs).toHaveCount(4)

    for (const label of ['Siguiendo', 'Tendencia', 'Destacados', 'Para ti']) {
      await page.getByRole('tab', { name: label }).click()
      await expect(page.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true')
    }

    // Nadie sigue a nadie todavía: la pestaña queda vacía, sin tarjetas rotas.
    await page.getByRole('tab', { name: 'Siguiendo' }).click()
    await expect(page.locator('.card')).toHaveCount(0)
    await expect(page.locator('.empty')).toBeVisible()
  })

  test('el buscador filtra por nombre', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await expect(page.locator('.card').first()).toBeVisible()

    const firstName = (await page.locator('.card .name').first().innerText()).trim()
    const total = await page.locator('.card').count()

    await page.getByLabel('Buscar personaje').fill(firstName)
    await expect(page.locator('.card')).toHaveCount(1)
    await expect(page.locator('.card .name')).toHaveText(firstName)

    await page.getByLabel('Buscar personaje').fill('zzzz-no-existe')
    await expect(page.locator('.card')).toHaveCount(0)
    await expect(page.locator('.empty')).toContainText('No encontré')

    await page.getByLabel('Buscar personaje').fill('')
    await expect(page.locator('.card')).toHaveCount(total)
  })

  test('la tarjeta abre la ficha del personaje', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await expect(page.locator('.card').first()).toBeVisible()

    const name = (await page.locator('.card .name').first().innerText()).trim()
    await page.locator('.card').first().click()

    await expect(page).toHaveURL(/\/personaje\//)
    await expect(page.locator('.ficha-name')).toHaveText(name)
    await expect(page.getByRole('link', { name: 'Chatear' })).toBeVisible()

    await page.getByRole('link', { name: 'Volver' }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})
