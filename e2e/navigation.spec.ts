import { test, expect } from '@playwright/test';

test.describe('Navegación', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL('/app/dashboard', { timeout: 10000 });
  });

  test('navega a Agenda de Turnos', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Agenda de Turnos' }).click();
    await expect(page).toHaveURL('/app/schedule');
  });

  test('navega a Cierre de Caja', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Cierre de Caja' }).click();
    await page.waitForURL('**/app/**', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Cierre de Caja' })).toBeVisible();
  });

  test('navega a Nueva Venta', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Nueva Venta' }).click();
    await page.waitForURL('**/app/**', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Nueva Venta' })).toBeVisible();
  });

  test('navega a Productos', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Productos' }).click();
    await page.waitForURL('**/app/**', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Productos', exact: true }).first()).toBeVisible();
  });

  test('navega a Reportes', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Reportes' }).click();
    await page.waitForURL('**/app/**', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
  });

  test('navega a Usuarios', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Usuarios' }).click();
    await page.waitForURL('**/app/**', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Usuarios', exact: true })).toBeVisible();
  });

  test('navega a Configuración', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Configuración' }).click();
    await page.waitForURL('**/app/**', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Configuración', exact: true })).toBeVisible();
  });

  test('navega de vuelta al Inicio desde otra sección', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Agenda de Turnos' }).click();
    await expect(page).toHaveURL('/app/schedule');
    await page.getByRole('navigation').getByRole('button', { name: 'Inicio' }).click();
    await expect(page).toHaveURL('/app/dashboard');
  });
});
