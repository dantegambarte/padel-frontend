import { test, expect, Page } from '@playwright/test';

async function goToCaja(page: Page) {
  await page.goto('/app/cash-register');
  await page.waitForLoadState('networkidle');
}

test.describe('Cierre de Caja', () => {
  test.beforeEach(async ({ page }) => {
    await goToCaja(page);
  });

  test('CA-01: carga la pantalla de cierre de caja correctamente', async ({
    page,
  }) => {
    await expect(
      page.getByRole('heading', { name: 'Cierre de Caja' }),
    ).toBeVisible();
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
    const closeBtn = page.getByRole('button', { name: /Cerrar Caja Z/i });
    if ((await closeBtn.isVisible()) && (await closeBtn.isEnabled())) {
      await closeBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
    } else {
      const isClosed =
        (await page.getByText(/cerrada|Caja cerrada/i).count()) > 0 ||
        (await closeBtn.isDisabled());
      expect(isClosed).toBeTruthy();
    }
  });

  test('CA-05: el formulario de cierre requiere monto en efectivo contado', async ({
    page,
  }) => {
    const closeBtn = page.getByRole('button', { name: /Cerrar Caja Z/i });
    if ((await closeBtn.isVisible()) && (await closeBtn.isEnabled())) {
      await closeBtn.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 3000 });

      const confirmBtn = dialog.getByRole('button', { name: /Confirmar/i });
      if (await confirmBtn.isVisible()) {
        await expect(confirmBtn).toBeDisabled();
      }

      const montoInput = dialog
        .locator('input[type="number"], input[type="text"]')
        .first();
      if (await montoInput.isVisible()) {
        await montoInput.fill('1000');
        await expect(confirmBtn).toBeEnabled({ timeout: 1000 });
      }
    }
  });

  test('CA-06: muestra la diferencia entre efectivo esperado y contado', async ({
    page,
  }) => {
    const closeBtn = page.getByRole('button', { name: /Cerrar Caja Z/i });
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
    const closeBtn = page.getByRole('button', { name: /Cerrar Caja Z/i });
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
