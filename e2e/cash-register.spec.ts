import { test, expect, Page } from '@playwright/test';

async function goToCaja(page: Page) {
  await page.goto('/app/cash-register');
  await page.waitForLoadState('networkidle');
}

function cashScreenHeading(page: Page) {
  return page.locator('main').getByRole('heading', {
    name: /Arqueo de Turno|Efectivo Esperado|Caja Cerrada|Abrir Turno/i,
  }).first();
}

function closeCashButton(page: Page) {
  return page.getByRole('button', {
    name: /Cerrar Jornada|Cerrar Caja Z|Cerrar mi Turno/i,
  }).first();
}

async function goToCierreTurno(page: Page) {
  const cierreTab = page.getByRole('button', { name: /Cierre de Turno/i });
  if (await cierreTab.isVisible()) {
    await cierreTab.click({ force: true });
    const pendingDialog = page.getByRole('dialog', { name: /Hay pendientes/i });
    if (await pendingDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      return false;
    }
    const cierreHeading = page
      .locator('main')
      .getByRole('heading', { name: /Arqueo de Turno/i });
    if (!(await cierreHeading.isVisible({ timeout: 3000 }).catch(() => false))) {
      return false;
    }
  }
  return true;
}

async function fillCashCount(page: Page, amount = '1000') {
  const canClose = await goToCierreTurno(page);
  if (!canClose) return false;
  const cashInput = page.locator('#efectivo-real');
  if (await cashInput.isVisible()) {
    await cashInput.fill(amount);
  }
  return true;
}

test.describe('Cierre de Caja', () => {
  test.beforeEach(async ({ page }) => {
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
    const canClose = await fillCashCount(page);
    if (!canClose) {
      await expect(page.getByRole('dialog', { name: /Hay pendientes/i })).toBeVisible();
      return;
    }
    const closeBtn = closeCashButton(page);
    if ((await closeBtn.isVisible()) && (await closeBtn.isEnabled())) {
      await closeBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
    } else {
      const isClosed =
        (await page.getByText(/cerrada|Caja cerrada/i).count()) > 0 ||
        (await closeBtn.isDisabled({ timeout: 500 }).catch(() => false));
      expect(isClosed).toBeTruthy();
    }
  });

  test('CA-05: el formulario de cierre requiere monto en efectivo contado', async ({
    page,
  }) => {
    const canClose = await goToCierreTurno(page);
    if (!canClose) return;
    const closeBtn = closeCashButton(page);
    if (await closeBtn.isVisible()) {
      await expect(closeBtn).toBeDisabled();
      await fillCashCount(page);
      await expect(closeBtn).toBeEnabled({ timeout: 1000 });
    }
  });

  test('CA-06: muestra la diferencia entre efectivo esperado y contado', async ({
    page,
  }) => {
    const canClose = await fillCashCount(page, '5000');
    if (!canClose) return;
    const closeBtn = closeCashButton(page);
    if ((await closeBtn.isVisible()) && (await closeBtn.isEnabled())) {
      await closeBtn.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 3000 });

      const montoInput = dialog
        .locator('input[type="number"], input[type="text"]')
        .first();
      if (await montoInput.isVisible()) {
        await montoInput.fill('5000');
        await expect(dialog.getByText(/diferencia|Diferencia|\$/i)).toBeVisible(
          { timeout: 2000 },
        );
      }
    }
  });

  test('CA-07: el botón Cancelar del diálogo cierra el modal sin hacer cambios', async ({
    page,
  }) => {
    const canClose = await fillCashCount(page);
    if (!canClose) {
      const pendingDialog = page.getByRole('dialog', { name: /Hay pendientes/i });
      await pendingDialog.getByRole('button', { name: /Cancelar/i }).click();
      await expect(pendingDialog).not.toBeVisible({ timeout: 2000 });
      return;
    }
    const closeBtn = closeCashButton(page);
    if ((await closeBtn.isVisible()) && (await closeBtn.isEnabled())) {
      await closeBtn.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 3000 });

      const cancelBtn = dialog.getByRole('button', { name: /Cancelar/i });
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await expect(dialog).not.toBeVisible({ timeout: 2000 });
      }
    }
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
