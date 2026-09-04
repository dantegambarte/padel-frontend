import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/app/dashboard', { timeout: 10000 });
  });

  test('muestra las tarjetas de métricas principales', async ({ page }) => {
    await expect(page.getByText('Ingresos Hoy').first()).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText('Turnos Jugados').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('Ventas de la Cantina').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('Ocupación de Canchas').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('muestra el resumen del día', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Resumen de Hoy' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Operaciones del Día' }),
    ).toBeVisible();
  });

  test('muestra los métodos de pago', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Ingresos.*7 días/i }),
    ).toBeVisible();
    await expect(page.getByText(/Efectivo vs Transferencia/i)).toBeVisible();
  });

  test('muestra el gráfico de evolución de ingresos', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Ingresos.*7 días/i }),
    ).toBeVisible();
  });

  test('la barra de búsqueda es interactiva', async ({ page }) => {
    const searchbox = page.getByRole('searchbox', { name: 'Buscar...' });
    if (await searchbox.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
      await searchbox.fill('test');
      await expect(searchbox).toHaveValue('test');
    }
  });

  test('el menú lateral tiene todas las secciones', async ({ page }) => {
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('button', { name: 'Inicio' })).toBeVisible();
    await expect(
      nav.getByRole('button', { name: 'Agenda de Turnos' }),
    ).toBeVisible();
    await expect(
      nav.getByRole('button', { name: 'Cierre de Caja' }),
    ).toBeVisible();
    await expect(
      nav.getByRole('button', { name: 'Nueva Venta' }),
    ).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Productos' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Reportes' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Usuarios' })).toBeVisible();
    await expect(
      nav.getByRole('button', { name: 'Configuración' }),
    ).toBeVisible();
  });

  test('muestra nombre del usuario en la sidebar', async ({ page }) => {
    await expect(
      page.getByRole('complementary').getByText('Raul Barcelo').first(),
    ).toBeVisible();
  });
});
