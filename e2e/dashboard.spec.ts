import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL('/app/dashboard', { timeout: 10000 });
  });

  test('muestra las tarjetas de métricas principales', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Ingresos Totales' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ingresos Canchas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ventas POS' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Transacciones' })).toBeVisible();
  });

  test('muestra el resumen del día', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Resumen del Día' })).toBeVisible();
    await expect(page.getByText('Total ingresos')).toBeVisible();
    await expect(page.getByText('Alquileres de cancha').first()).toBeVisible();
    await expect(page.getByText('Ventas de productos').first()).toBeVisible();
  });

  test('muestra los métodos de pago', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Métodos de Pago' })).toBeVisible();
    await expect(page.getByText('Efectivo')).toBeVisible();
    await expect(page.getByText('Transferencia')).toBeVisible();
  });

  test('muestra el gráfico de evolución de ingresos', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Evolución de Ingresos (Semanal)' })).toBeVisible();
  });

  test('la barra de búsqueda es interactiva', async ({ page }) => {
    const searchbox = page.getByRole('searchbox', { name: 'Buscar...' });
    await expect(searchbox).toBeVisible();
    await searchbox.fill('test');
    await expect(searchbox).toHaveValue('test');
  });

  test('el menú lateral tiene todas las secciones', async ({ page }) => {
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('button', { name: 'Inicio' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Agenda de Turnos' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Cierre de Caja' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Nueva Venta' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Productos' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Reportes' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Usuarios' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Configuración' })).toBeVisible();
  });

  test('muestra nombre del usuario en la sidebar', async ({ page }) => {
    await expect(page.getByRole('complementary').getByText('Raul Barcelo').first()).toBeVisible();
  });
});
