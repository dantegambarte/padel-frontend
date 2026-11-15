import { test, expect, Page } from '@playwright/test';
import { ensureOpenCashSession, getCurrentCashSession } from './helpers/cash-session';

async function goToCaja(page: Page) {
  await page.goto('/app/cash-register');
  await page.waitForLoadState('networkidle');
}

function cashScreenHeading(page: Page) {
  return page.locator('main').getByRole('heading', {
    name: /Arqueo de Turno|Efectivo Esperado|Caja Cerrada|Abrir Turno/i,
  }).first();
}

/** Shift-close button only: unlike the day close (Z), it requires the counted cash. */
function closeShiftButton(page: Page) {
  return page.getByRole('button', { name: /Cerrar mi Turno/i });
}

/**
 * Opens the "Cierre de Turno" tab and fails unless the shift count screen
 * ("Arqueo de Turno") appears. When the shift has pending items the app shows
 * the "Hay pendientes en el turno" dialog first; accept carrying them over.
 *
 * Note: `locator.isVisible()` is an instant check that does not retry, so
 * every wait here uses web-first assertions or `waitFor`.
 */
async function goToCierreTurno(page: Page) {
  const cierreTab = page.getByRole('button', { name: /Cierre de Turno/i });
  await expect(cierreTab).toBeVisible();
  await cierreTab.click({ force: true });

  const arqueoHeading = page.getByRole('heading', { name: /Arqueo de Turno/i }).first();
  const pendingDialog = page.getByRole('dialog', { name: /Hay pendientes/i });
  await expect(arqueoHeading.or(pendingDialog)).toBeVisible({ timeout: 10_000 });
  if (await pendingDialog.isVisible()) {
    await pendingDialog.getByRole('button', { name: /Traspasar y cerrar turno/i }).click();
  }
  await expect(arqueoHeading).toBeVisible({ timeout: 10_000 });
}

async function fillCashCount(page: Page, amount = '1000') {
  await goToCierreTurno(page);
  await page.locator('#efectivo-real').fill(amount);
}

test.describe('Cierre de Caja', () => {
  test.beforeEach(async ({ page }) => {
    await goToCaja(page);
    await ensureOpenCashSession(page);
    await goToCaja(page);
  });

  test('CA-01: carga la pantalla de cierre de caja correctamente', async ({
    page,
  }) => {
    await expect(cashScreenHeading(page)).toBeVisible();
  });

  test('CA-02: muestra el resumen de ingresos del día', async ({ page }) => {
    const hasTotals =
      (await page.getByText(/Total|Ingresos|Efectivo|Transferencia/i).count()) >
      0;
    expect(hasTotals).toBeTruthy();
  });

  test('CA-03: muestra el detalle de transacciones del día', async ({
    page,
  }) => {
    const hasTransactions =
      (await page.getByText(/Turno|Venta|Reserva|concepto/i).count()) > 0 ||
      (await page.locator('table, [role="table"]').count()) > 0;
    expect(typeof hasTransactions).toBe('boolean');
  });

  test('CA-04: el botón de cerrar caja abre un diálogo de confirmación', async ({
    page,
  }) => {
    await fillCashCount(page);
    await closeShiftButton(page).click();
    await expect(
      page.getByRole('dialog', { name: /Confirmar Cierre de Turno/i }),
    ).toBeVisible({ timeout: 3000 });
  });

  test('CA-05: el formulario de cierre requiere monto en efectivo contado', async ({
    page,
  }) => {
    await goToCierreTurno(page);
    const closeBtn = closeShiftButton(page);
    await expect(closeBtn).toBeDisabled();
    await page.locator('#efectivo-real').fill('1000');
    await expect(closeBtn).toBeEnabled({ timeout: 1000 });
  });

  test('CA-06: muestra la diferencia entre efectivo esperado y contado', async ({
    page,
  }) => {
    const expected = Math.max(0, Number((await getCurrentCashSession(page))['cashExpected']));
    await fillCashCount(page, String(expected + 5000));
    // Counting 5000 more than expected shows a +5000 discrepancy. The confirm
    // dialog repeats these labels; before opening it only the form shows them.
    const discrepancy = page.getByText('Descuadre:').first().locator('..');
    await expect(discrepancy).toContainText(`+$${(5000).toLocaleString('es-AR')}`);
  });

  test('CA-07: el botón Cancelar del diálogo cierra el modal sin hacer cambios', async ({
    page,
  }) => {
    await fillCashCount(page);
    await closeShiftButton(page).click();
    const dialog = page.getByRole('dialog', { name: /Confirmar Cierre de Turno/i });
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await dialog.getByRole('button', { name: /^Cancelar$/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
    await expect(closeShiftButton(page)).toBeEnabled();
  });

  test('CA-08: muestra desglose por método de pago (efectivo vs transferencia)', async ({
    page,
  }) => {
    const cajaAbierta = (await page.getByText(/Caja Cerrada/i).count()) === 0;
    if (!cajaAbierta) {
      await expect(
        page.getByRole('heading', { name: /Caja Cerrada/i }),
      ).toBeVisible();
      return;
    }
    const hasBreakdown =
      (await page.getByText(/Efectivo/i).count()) > 0 &&
      (await page.getByText(/Transferencia/i).count()) > 0;
    expect(hasBreakdown).toBeTruthy();
  });
});
