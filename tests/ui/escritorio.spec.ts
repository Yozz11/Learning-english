import { expect, test } from '@playwright/test'
import { DESKTOP, box, expectClose, expectNoHorizontalScroll, login } from './helpers'

// Paso 7: ajustes de escritorio. El plano solo trae dos marcos grandes (inicio y
// charla), así que aquí se comprueba lo que debe cumplir TODO el escritorio:
// barra lateral fija, nada que se salga a lo ancho y las columnas centradas en
// el hueco que deja la barra (no en la pantalla entera).

const ROUTES = ['/', '/subir', '/perfil', '/test', '/novedades']

test.describe('escritorio', () => {
  test('las pantallas de contenido quedan centradas y no desbordan', async ({ page }) => {
    await login(page)
    await page.setViewportSize(DESKTOP)

    const sidebar = await box(page, '.sidebar')
    expect(sidebar.display, 'la barra lateral se ve en el escritorio').toBe('flex')

    // El centro del hueco que queda a la derecha de la barra lateral.
    const centerOfMain = (sidebar.right + DESKTOP.width) / 2
    let checked = 0

    for (const route of ROUTES) {
      await page.goto(route)
      await expect(page.locator('.sidebar')).toBeVisible()
      await expect(page.locator('.bottom-nav')).toBeHidden()
      await expectNoHorizontalScroll(page, DESKTOP.width)

      const column = page.locator('.pantalla, .home').first()
      await expect(column).toBeVisible()

      const measured = await box(page, '.pantalla, .home', 0)
      if (route === '/') continue // El inicio es una cuadrícula, no una columna.
      checked += 1
      expect(measured.width, `la columna de ${route} no pasa de 560 px`).toBeLessThanOrEqual(561)
      expectClose(
        (measured.left + measured.right) / 2,
        centerOfMain,
        `el centro de la columna de ${route}`,
        2,
      )
    }

    expect(checked, 'se midieron las cuatro pantallas de contenido').toBe(ROUTES.length - 1)
  })

  test('la ficha del personaje entra en el escritorio', async ({ page }) => {
    await login(page)
    await page.setViewportSize(DESKTOP)
    await page.goto('/')
    await page.locator('.card').first().click()

    await expect(page.locator('.ficha-name')).toBeVisible()
    await expectNoHorizontalScroll(page, DESKTOP.width)

    // En el escritorio el inicio estorba: la ficha se ve sola y centrada.
    const ficha = await box(page, '.ficha')
    const sidebar = await box(page, '.sidebar')
    expect(ficha.width, 'la ficha no pasa de 520 px').toBeLessThanOrEqual(521)
    expectClose(
      (ficha.left + ficha.right) / 2,
      (sidebar.right + DESKTOP.width) / 2,
      'el centro de la ficha',
      2,
    )
  })

  test('la charla del escritorio trae el panel del personaje a la derecha', async ({ page }) => {
    await login(page)
    await page.setViewportSize(DESKTOP)
    await page.goto('/')
    await page.locator('.card').first().click()
    await page.getByRole('link', { name: 'Chatear' }).click()
    await expect(page.locator('.chat-msgs')).toBeVisible()

    const panel = await box(page, '.chat-panel')
    expect(panel.display, 'el panel se ve en el escritorio').toBe('block')
    expectClose(panel.width, 320, 'ancho del panel')
    expectClose(panel.right, DESKTOP.width, 'el panel toca el borde derecho')

    // La columna de la charla se limita a 820 px y se centra en el hueco.
    const sidebar = await box(page, '.sidebar')
    const head = await box(page, '.chat-head')
    expect(head.width, 'la cabecera no pasa de 820 px').toBeLessThanOrEqual(821)
    expectClose(head.left, sidebar.right, 'la cabecera arranca donde acaba la barra lateral')

    await expectNoHorizontalScroll(page, DESKTOP.width)
  })
})
