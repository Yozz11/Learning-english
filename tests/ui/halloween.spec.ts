import { expect, test } from '@playwright/test'
import { DESKTOP, MOBILE, box, expectClose, expectNoHorizontalScroll, login } from './helpers'

// Adornos de temporada (Halloween): una capa fija por detrás del contenido, que
// no ocupa sitio, no recibe clics y no mueve nada de lo que mide el plano.

test.describe('adornos de Halloween', () => {
  test('la capa de adornos existe, no recibe clics y va por detrás', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')

    const decor = page.locator('.halloween')
    await expect(decor, 'la capa de adornos está en la app').toBeAttached()
    await expect(decor, 'los adornos no son contenido de verdad').toHaveAttribute(
      'aria-hidden',
      'true',
    )

    const layer = await box(page, '.halloween')
    expect(layer.position, 'la capa va fija en la pantalla').toBe('fixed')
    expect(layer.display, 'la capa se pinta').not.toBe('none')

    const styles = await decor.evaluate((element) => {
      const style = getComputedStyle(element)
      return { pointerEvents: style.pointerEvents, zIndex: style.zIndex }
    })
    expect(styles.pointerEvents, 'los adornos no reciben clics').toBe('none')
    expect(styles.zIndex, 'los adornos van por detrás del contenido').toBe('-1')

    // Son dibujos de verdad, no un hueco vacío.
    const drawings = page.locator('.halloween svg')
    expect(await drawings.count(), 'hay varios adornos').toBeGreaterThanOrEqual(4)

    // Y se ven dentro de la pantalla: ninguno se sale por arriba ni a los lados.
    const cobweb = await box(page, '.halloween .cobweb')
    const pumpkin = await box(page, '.halloween .pumpkin')
    expect(cobweb.top, 'la telaraña arranca en la esquina').toBeGreaterThanOrEqual(0)
    expect(pumpkin.top, 'la calabaza se ve en pantalla').toBeGreaterThan(0)
    expect(pumpkin.left, 'la calabaza entra por la izquierda').toBeGreaterThanOrEqual(0)

    // Por encima de la barra inferior: no se le encima.
    const nav = await box(page, '.bottom-nav')
    expect(pumpkin.bottom, 'la calabaza no tapa la barra').toBeLessThanOrEqual(nav.top + 1)
  })

  test('los adornos no mueven nada del plano y no sacan scroll horizontal', async ({ page }) => {
    await login(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')

    // La barra inferior y los iconos siguen igual que antes de los adornos.
    const nav = await box(page, '.bottom-nav')
    expectClose(nav.height, 84, 'alto de la barra inferior')
    const items = page.locator('.bottom-nav .nav-item')
    for (let index = 0; index < (await items.count()); index += 1) {
      const item = await box(page, '.bottom-nav .nav-item', index)
      expect(Math.min(item.width, item.height), `el icono ${index} sigue en 44 px o más`).toBeGreaterThanOrEqual(
        44,
      )
    }

    await expectNoHorizontalScroll(page, MOBILE.width)
  })

  test('en el escritorio el nombre va en naranja de temporada', async ({ page }) => {
    await login(page)
    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    const brand = await box(page, '.sidebar .brand')
    expect(brand.color, 'el nombre lleva el naranja de Halloween').toBe('rgb(232, 121, 31)')
    // El color no cambia el tamaño que vigila el plano.
    expect(brand.fontSize).toBe('28px')

    await expect(page.locator('.halloween'), 'los adornos también en el escritorio').toBeAttached()
    await expectNoHorizontalScroll(page, DESKTOP.width)
  })
})
