import { test, expect, Page } from '@playwright/test';

/**
 * En mobile el sidebar está colapsado (`-translate-x-full`) — hay que abrirlo
 * antes de clickear nav items. A partir del breakpoint `xl` (1280px) el aside
 * es fijo y el hamburguesa está oculto por CSS (`xl:hidden`).
 *
 * Decidimos por viewport y NO por "¿se ve el botón?": el shell se carga de
 * forma lazy, así que justo después de que la URL cambia el hamburguesa puede
 * todavía no existir en el DOM. La versión anterior sondeaba con
 * `isVisible({ timeout: 500 })` y un `.catch(() => false)`, con lo cual un
 * "todavía no cargó" se volvía indistinguible de un "no hace falta abrirlo":
 * el sidebar quedaba cerrado y los clicks posteriores fallaban con el nav item
 * fuera del viewport.
 */
const XL_BREAKPOINT = 1280;

async function openSidebarIfNeeded(page: Page) {
  const width = page.viewportSize()?.width ?? 0;
  if (width >= XL_BREAKPOINT) return;

  const hamburger = page.getByRole('button', { name: /Abrir menú|Open menu/i });
  await hamburger.waitFor({ state: 'visible', timeout: 15000 });
  await hamburger.click();

  // Esperar el estado real, no un timeout arbitrario.
  await expect(page.locator('aside').first()).toHaveClass(/translate-x-0/);
}

async function clickNavItem(page: Page, name: string) {
  const item = page.getByRole('navigation').getByRole('button', { name });
  await item.scrollIntoViewIfNeeded();
  await item.click();
}

async function expectMainHeading(page: Page, name: RegExp) {
  await expect(page.locator('main').getByRole('heading', { name }).first()).toBeVisible();
}

test.describe('Navegación', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL('/app/dashboard', { timeout: 10000 });
    await openSidebarIfNeeded(page);
  });

  test('navega a Agenda de Turnos', async ({ page }) => {
    await clickNavItem(page, 'Agenda de Turnos');
    await expect(page).toHaveURL('/app/schedule');
  });

  test('navega a Cierre de Caja', async ({ page }) => {
    await clickNavItem(page, 'Cierre de Caja');
    await page.waitForURL('**/app/**', { timeout: 5000 });
    await expectMainHeading(page, /Arqueo de Turno|Efectivo Esperado|Abrir Turno|Caja Cerrada/i);
  });

  test('navega a Nueva Venta', async ({ page }) => {
    await clickNavItem(page, 'Nueva Venta');
    await page.waitForURL('**/app/**', { timeout: 5000 });
    await expectMainHeading(page, /Catálogo de Productos|Carrito|Nueva Venta/i);
  });

  test('navega a Productos', async ({ page }) => {
    await clickNavItem(page, 'Productos');
    await page.waitForURL('**/app/**', { timeout: 5000 });
    await expectMainHeading(page, /Productos/i);
  });

  test('navega a Reportes', async ({ page }) => {
    await clickNavItem(page, 'Reportes');
    await page.waitForURL('**/app/**', { timeout: 5000 });
    await expectMainHeading(page, /Balance Financiero|Flujo de Caja|Reportes/i);
  });

  test('navega a Usuarios', async ({ page }) => {
    await clickNavItem(page, 'Usuarios');
    await page.waitForURL('**/app/**', { timeout: 5000 });
    await expectMainHeading(page, /Usuarios/i);
  });

  test('navega a Configuración', async ({ page }) => {
    await clickNavItem(page, 'Configuración');
    await page.waitForURL('**/app/**', { timeout: 5000 });
    await expectMainHeading(page, /Configuración/i);
  });

  test('navega de vuelta al Inicio desde otra sección', async ({ page }) => {
    await clickNavItem(page, 'Agenda de Turnos');
    await expect(page).toHaveURL('/app/schedule');
    await openSidebarIfNeeded(page);
    await clickNavItem(page, 'Inicio');
    await expect(page).toHaveURL('/app/dashboard');
  });
});
