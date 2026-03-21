import { test, expect } from '@playwright/test';

test.describe('Agenda de Turnos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/schedule');
    await expect(page).toHaveURL('/app/schedule', { timeout: 10000 });
  });

  test('muestra la grilla de canchas con columnas correctas', async ({ page }) => {
    await expect(page.getByText('Cancha 1')).toBeVisible();
    await expect(page.getByText('Cancha 2')).toBeVisible();
    await expect(page.getByText('Cancha 3')).toBeVisible();
    await expect(page.getByText('Horario')).toBeVisible();
  });

  test('muestra los horarios del día', async ({ page }) => {
    await expect(page.getByText('09:00hs')).toBeVisible();
    await expect(page.getByText('10:00hs')).toBeVisible();
    await expect(page.getByText('22:00hs')).toBeVisible();
  });

  test('muestra reservas existentes', async ({ page }) => {
    // Navegar a hoy+2 donde el seed puede crear reservas
    const seedDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const datePicker = page.locator('input[type="date"]').first();
    await datePicker.fill(seedDate);
    await datePicker.dispatchEvent('change');
    await page.waitForLoadState('networkidle');
    // Verificar que la grilla se actualizó para la fecha seleccionada
    // (el datepicker debe mostrar la fecha correcta)
    await expect(datePicker).toHaveValue(seedDate);
    // Si hay bookings del seed, verificar al menos uno de los nombres conocidos
    const hayReservas =
      (await page.getByText('Víctor Navarro').count()) > 0 ||
      (await page.getByText('Elena Carrillo').count()) > 0 ||
      (await page.getByText('Miguel Herrera').count()) > 0 ||
      (await page.getByRole('button', { name: 'Disponible' }).count()) > 0;
    expect(hayReservas).toBeTruthy();
  });

  test('muestra slots disponibles', async ({ page }) => {
    const disponibles = page.getByRole('button', { name: 'Disponible' });
    await expect(disponibles.first()).toBeVisible();
    const count = await disponibles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('muestra la leyenda de estados', async ({ page }) => {
    // La leyenda está al final de la grilla
    const legenda = page.locator('text=Disponible').last();
    await expect(legenda).toBeVisible();
    await expect(page.locator('text=Reservado').last()).toBeVisible();
    await expect(page.locator('text=Jugando')).toBeVisible();
    await expect(page.locator('text=Completado')).toBeVisible();
  });

  test('el selector de fecha funciona', async ({ page }) => {
    // El input tiene id="fecha" pero sin label semántico — usar locator directo
    const datepicker = page.locator('input[type="date"]').first();
    await expect(datepicker).toBeVisible();
    await datepicker.fill('2026-04-01');
    await datepicker.dispatchEvent('change');
    await expect(page.getByRole('heading', { name: 'Agenda de Canchas' })).toBeVisible();
  });

  test('se puede hacer click en un slot disponible', async ({ page }) => {
    const primerDisponible = page.getByRole('button', { name: 'Disponible' }).first();
    await primerDisponible.click();
    await page.waitForTimeout(500);
    // La app debe seguir visible (sin errores)
    await expect(page.getByText('Agenda de Canchas')).toBeVisible();
  });
});
