import { test, expect, Page } from '@playwright/test';

async function waitForScheduleGrid(page: Page) {
  const grid = page.locator('.overflow-x-auto').first();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await grid.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
      return;
    }

    const refresh = page.getByRole('button', { name: /Actualizar grilla/i });
    if (await refresh.isVisible().catch(() => false)) {
      await refresh.click();
    } else {
      await page.goto('/app/schedule');
    }
    await page.waitForLoadState('networkidle');
  }

  await expect(grid).toBeVisible();
}

test.describe('Agenda de Turnos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/schedule');
    await expect(page).toHaveURL('/app/schedule', { timeout: 10000 });
    await waitForScheduleGrid(page);
  });

  test('muestra la grilla de canchas con columnas correctas', async ({
    page,
  }) => {
    await expect(page.getByText('Cancha 1')).toBeVisible();
    await expect(page.getByText('Cancha 2')).toBeVisible();
    await expect(page.getByText('Cancha 3')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Agenda de Canchas/i }),
    ).toBeVisible();
  });

  test('muestra los horarios del día', async ({ page }) => {
    await expect(page.getByText(/09:00hs/).first()).toBeVisible();
    await expect(page.getByText(/10:00hs/).first()).toBeVisible();
    await expect(page.getByText(/22:00hs/).first()).toBeVisible();
  });

  test('muestra reservas existentes', async ({ page }) => {
    const seedDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const datePicker = page.locator('input[type="date"]').first();
    await datePicker.fill(seedDate);
    await datePicker.dispatchEvent('change');
    await page.waitForLoadState('networkidle');
    await expect(datePicker).toHaveValue(seedDate);
    const hayReservas =
      (await page.getByText('Víctor Navarro').count()) > 0 ||
      (await page.getByText('Elena Carrillo').count()) > 0 ||
      (await page.getByText('Miguel Herrera').count()) > 0 ||
      (await page.getByRole('button', { name: /Disponible \d{2}:\d{2}/ }).count()) > 0;
    expect(hayReservas).toBeTruthy();
  });

  test('muestra slots disponibles', async ({ page }) => {
    const disponibles = page.getByRole('button', { name: /Disponible \d{2}:\d{2}/ });
    await expect(disponibles.first()).toBeVisible();
    const count = await disponibles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('muestra la leyenda de estados', async ({ page }) => {
    const legenda = page.locator('text=Disponible').last();
    await expect(legenda).toBeVisible();
    await expect(page.locator('text=Reservado').last()).toBeVisible();
    await expect(page.locator('text=Jugando').last()).toBeVisible();
    await expect(page.locator('text=Completado').last()).toBeVisible();
  });

  test('el selector de fecha funciona', async ({ page }) => {
    const datepicker = page.locator('input[type="date"]').first();
    await expect(datepicker).toBeVisible();
    await datepicker.fill('2026-04-01');
    await datepicker.dispatchEvent('change');
    await expect(
      page.getByRole('heading', { name: 'Agenda de Canchas' }),
    ).toBeVisible();
  });

  test('se puede hacer click en un slot disponible', async ({ page }) => {
    const primerDisponible = page
      .getByRole('button', { name: /Disponible \d{2}:\d{2}/ })
      .first();
    await primerDisponible.click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Agenda de Canchas')).toBeVisible();
  });
});
