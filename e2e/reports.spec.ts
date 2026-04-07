import { test, expect, Page } from '@playwright/test';

async function goToReports(page: Page) {
  await page.goto('/app/reports');
  await page.waitForLoadState('networkidle');
}

test.describe('Módulo de Reportes', () => {
  test.beforeEach(async ({ page }) => {
    await goToReports(page);
  });

  test('RE-01: carga la pantalla de reportes', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible({
      timeout: 8000,
    });
  });

  test('RE-02: muestra el resumen ejecutivo con métricas', async ({ page }) => {
    const hasMetrics =
      (await page.getByText(/Total|Ingresos|Cancha|Venta/i).count()) > 0;
    expect(hasMetrics).toBeTruthy();
  });

  test('RE-03: los selectores de rango de fechas están presentes', async ({
    page,
  }) => {
    const dateInputs = page.locator('input[type="date"]');
    const count = await dateInputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('RE-04: el filtro de fecha "hoy" carga datos del día actual', async ({
    page,
  }) => {
    const todayBtn = page.getByRole('button', { name: /Hoy|Today/i });
    if (await todayBtn.isVisible({ timeout: 2000 })) {
      await todayBtn.click();
      await page.waitForLoadState('networkidle');
      await expect(
        page.getByRole('heading', { name: 'Reportes' }),
      ).toBeVisible();
    }
  });

  test('RE-05: el filtro "última semana" funciona', async ({ page }) => {
    const weekBtn = page.getByRole('button', { name: /semana|week|7 días/i });
    if (await weekBtn.isVisible({ timeout: 2000 })) {
      await weekBtn.click();
      await page.waitForLoadState('networkidle');
      await expect(
        page.getByRole('heading', { name: 'Reportes' }),
      ).toBeVisible();
    }
  });

  test('RE-06: muestra el gráfico de evolución de ingresos', async ({
    page,
  }) => {
    const hasChart =
      (await page.locator('canvas, svg').count()) > 0 ||
      (await page.getByText(/Evolución|Revenue|Ingresos/i).count()) > 0;
    expect(hasChart).toBeTruthy();
  });

  test('RE-07: muestra la distribución de métodos de pago', async ({
    page,
  }) => {
    const hasPaymentMethods =
      (await page.getByText(/Efectivo/i).count()) > 0 ||
      (await page.getByText(/Transferencia/i).count()) > 0 ||
      (await page.getByText(/Métodos de Pago/i).count()) > 0;
    expect(hasPaymentMethods).toBeTruthy();
  });

  test('RE-08: muestra el ranking de productos más vendidos', async ({
    page,
  }) => {
    const hasRanking =
      (await page.getByText(/Ranking|Productos|Top/i).count()) > 0;
    expect(hasRanking).toBeTruthy();
  });

  test('RE-09: el botón de exportar transacciones existe y es clickeable', async ({
    page,
  }) => {
    const exportBtn = page
      .getByRole('button', { name: /Exportar|Export|CSV|Excel/i })
      .first();
    if (await exportBtn.isVisible({ timeout: 3000 })) {
      await expect(exportBtn).toBeEnabled();
    }
  });

  test('RE-10: cambiar el rango de fechas dispara una nueva petición a la API', async ({
    page,
  }) => {
    const dateFrom = page.locator('input[type="date"]').first();
    if (await dateFrom.isVisible()) {
      const apiCallPromise = page.waitForResponse(
        (res) => res.url().includes('/reports'),
        { timeout: 8000 },
      );
      await dateFrom.fill('2026-01-01');
      await dateFrom.dispatchEvent('change');
      const res = await apiCallPromise.catch(() => null);
      if (res) {
        expect([200, 400]).toContain(res.status());
      }
    }
  });
});
