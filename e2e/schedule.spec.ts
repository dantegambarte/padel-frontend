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
    await expect(page.getByText('Víctor Navarro')).toBeVisible();
    await expect(page.getByText('Elena Carrillo')).toBeVisible();
    await expect(page.getByText('Miguel Herrera')).toBeVisible();
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
    const datepicker = page.getByRole('textbox', { name: 'Fecha:' });
    await expect(datepicker).toBeVisible();
    await datepicker.fill('2026-03-12');
    await page.getByRole('button', { name: 'Actualizar grilla' }).click();
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
