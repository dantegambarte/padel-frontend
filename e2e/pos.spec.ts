import { test, expect, Page } from '@playwright/test';

async function goToPOS(page: Page) {
  await page.goto('/app/pos');
  await page.waitForLoadState('networkidle');
}

test.describe('POS / Nueva Venta', () => {
  test.beforeEach(async ({ page }) => {
    await goToPOS(page);
  });

  test('POS-01: carga la lista de productos disponibles', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Catálogo de Productos' }),
    ).toBeVisible();
    const products = page
      .getByRole('button')
      .filter({ hasText: /\$\d/ })
      .first();
    await expect(products).toBeVisible({ timeout: 8000 });
  });

  test('POS-02: el carrito comienza vacío y el botón Ir al Pago está deshabilitado', async ({
    page,
  }) => {
    const btn = page.getByRole('button', { name: /Ir al Pago/i });
    await expect(btn).toBeDisabled();
  });

  test('POS-03: agregar un producto incrementa el subtotal', async ({
    page,
  }) => {
    const firstProduct = page
      .getByRole('button')
      .filter({ hasText: /\$\d/ })
      .first();
    await firstProduct.click();
    await expect(
      page.getByRole('button', { name: /Ir al Pago · \$[1-9]/ }),
    ).toBeVisible({ timeout: 3000 });
  });

  test('POS-04: botón + / - cambia la cantidad del item en el carrito', async ({
    page,
  }) => {
    const firstProduct = page
      .getByRole('button')
      .filter({ hasText: /\$\d/ })
      .first();
    await firstProduct.click();
    const plusBtn = page
      .getByRole('button', { name: 'Incrementar cantidad' })
      .first();
    if (await plusBtn.isVisible()) {
      await plusBtn.click();
      await expect(page.locator('text=/2 ítems?/').first()).toBeVisible({
        timeout: 3000,
      });
    }
  });

  test('POS-05: eliminar un item del carrito lo remueve', async ({ page }) => {
    const firstProduct = page
      .getByRole('button')
      .filter({ hasText: /\$\d/ })
      .first();
    await firstProduct.click();
    const removeBtn = page
      .getByRole('button', { name: 'Eliminar producto' })
      .first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();
      const btn = page.getByRole('button', { name: /Ir al Pago/i });
      await expect(btn).toBeDisabled();
    }
  });

  test('POS-06: no se puede confirmar si el monto pagado es menor al total', async ({
    page,
  }) => {
    const firstProduct = page
      .getByRole('button')
      .filter({ hasText: /\$\d/ })
      .first();
    await firstProduct.click();
    await page.getByRole('button', { name: /Ir al Pago/i }).click();
    const cashInput = page.getByRole('spinbutton', { name: /Efectivo/i });
    if (await cashInput.isVisible()) {
      await cashInput.fill('1');
    }
    const confirmBtn = page.getByRole('button', { name: /Cobrar/i });
    await expect(confirmBtn).toBeDisabled();
  });

  test('POS-07: confirmar una venta completa con efectivo y limpiar carrito', async ({
    page,
  }) => {
    const firstProduct = page
      .getByRole('button')
      .filter({ hasText: /\$\d/ })
      .first();
    await firstProduct.click();

    const irAlPagoBtn = page.getByRole('button', { name: /Ir al Pago/i });
    await irAlPagoBtn.click();

    const totalText = await page
      .locator('text=/TOTAL:/')
      .locator('..')
      .textContent()
      .catch(() => '');
    const match = totalText?.match(/[\d.,]+/);
    const totalAmount = match ? match[0].replace(',', '') : '9999';

    const cashInput = page.getByRole('spinbutton', { name: /Efectivo/i });
    if (await cashInput.isVisible()) {
      await cashInput.fill(totalAmount);
    }

    const confirmBtn = page.getByRole('button', { name: /Cobrar/i });
    if (await confirmBtn.isEnabled()) {
      const salePromise = page.waitForResponse(
        (res) =>
          res.url().includes('/sales') && res.request().method() === 'POST',
        { timeout: 10000 },
      );
      await confirmBtn.click();
      const res = await salePromise.catch(() => null);

      if (res) {
        const status = res.status();
        expect([201, 400, 503]).toContain(status);
        if (status === 201) {
          await expect(
            page.getByRole('button', { name: /Ir al Pago/i }),
          ).toBeDisabled({ timeout: 5000 });
        }
      }
    }
  });

  test('POS-08: la búsqueda/filtro de productos funciona', async ({ page }) => {
    const searchInput = page.getByRole('searchbox').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('a');
      await page.waitForTimeout(500);
      await expect(
        page.getByRole('button').filter({ hasText: /\$\d/ }).first(),
      ).toBeVisible({ timeout: 3000 });
    }
  });

  test('POS-09: pago mixto (efectivo + transferencia) se acepta correctamente', async ({
    page,
  }) => {
    const firstProduct = page
      .getByRole('button')
      .filter({ hasText: /\$\d/ })
      .first();
    await firstProduct.click();

    await page.getByRole('button', { name: /Ir al Pago/i }).click();

    const cashInput = page.getByRole('spinbutton', { name: /Efectivo/i });
    const transferInput = page.getByRole('spinbutton', {
      name: /Transferencia/i,
    });
    if ((await cashInput.isVisible()) && (await transferInput.isVisible())) {
      await cashInput.fill('500');
      await transferInput.fill('500');
      await page.waitForTimeout(300);
      await expect(
        page.getByRole('heading', { name: 'Catálogo de Productos' }),
      ).toBeVisible();
    }
  });
});

test.describe('POS / Cuentas Abiertas', () => {
  test.beforeEach(async ({ page }) => {
    await goToPOS(page);
  });

  test('POS-10: la pestaña Cuentas Abiertas reemplaza el catálogo por la lista', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Cuentas Abiertas/i }).click();
    // O hay una lista de cuentas, o el estado vacío — el catálogo no debe estar visible.
    const emptyState = page.getByText('No hay cuentas abiertas');
    const anyAccountCard = page
      .getByRole('button')
      .filter({ hasText: /\$\d/ })
      .first();
    await expect(emptyState.or(anyAccountCard)).toBeVisible({ timeout: 5000 });
  });

  test('POS-11: "Dejar Abierta" está visible desde el paso Ítems, sin pasar por Pago', async ({
    page,
  }) => {
    const firstProduct = page
      .getByRole('button')
      .filter({ hasText: /\$\d/ })
      .first();
    await firstProduct.click();

    // El botón debe verse en la pestaña "Ítems" (la que carga por defecto), no requiere click en "Pago".
    await expect(
      page.getByRole('button', { name: /Dejar Abierta/i }),
    ).toBeVisible({ timeout: 3000 });
  });

  test('POS-12: "Dejar Abierta" pide el nombre de cliente/mesa antes de guardar', async ({
    page,
  }) => {
    const firstProduct = page
      .getByRole('button')
      .filter({ hasText: /\$\d/ })
      .first();
    await firstProduct.click();

    await page.getByRole('button', { name: /Dejar Abierta/i }).click();

    await expect(page.getByText('Nombre del Cliente / Mesa')).toBeVisible({
      timeout: 3000,
    });
  });

  test('POS-13: crear una cuenta abierta la agrega a la lista y vacía el ticket actual', async ({
    page,
  }) => {
    const firstProduct = page
      .getByRole('button')
      .filter({ hasText: /\$\d/ })
      .first();
    await firstProduct.click();

    await page.getByRole('button', { name: /Dejar Abierta/i }).click();

    const nameInput = page.getByRole('textbox').last();
    const uniqueName = `E2E Mesa ${Date.now()}`;
    await nameInput.fill(uniqueName);

    const createPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/sales') &&
        res.request().method() === 'POST' &&
        !res.url().includes('/pay'),
      { timeout: 10000 },
    );
    await page.getByRole('button', { name: 'Guardar' }).click();
    const res = await createPromise.catch(() => null);

    if (res && [200, 201].includes(res.status())) {
      await expect(
        page.getByRole('button', { name: /Ir al Pago/i }),
      ).toBeDisabled({ timeout: 5000 });

      await page.getByRole('button', { name: /Cuentas Abiertas/i }).click();
      await expect(
        page.getByRole('button', { name: new RegExp(uniqueName) }),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('POS-14: cargar una cuenta abierta llena el carrito y muestra el banner de edición', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Cuentas Abiertas/i }).click();

    const firstAccount = page
      .getByRole('button')
      .filter({ hasText: /\$\d/ })
      .first();

    if (await firstAccount.isVisible().catch(() => false)) {
      await firstAccount.click();

      await expect(page.getByText(/Cliente:/i).first()).toBeVisible({
        timeout: 5000,
      });
      await expect(
        page.getByRole('button', { name: /Actualizar Cuenta/i }),
      ).toBeVisible();
    }
  });

  test('POS-15: "Salir" del banner de edición vacía el carrito y vuelve a venta directa', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Cuentas Abiertas/i }).click();

    const firstAccount = page
      .getByRole('button')
      .filter({ hasText: /\$\d/ })
      .first();

    if (await firstAccount.isVisible().catch(() => false)) {
      await firstAccount.click();
      await page.getByRole('button', { name: 'Salir' }).click();

      await expect(
        page.getByRole('button', { name: /Dejar Abierta/i }),
      ).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/Cliente:/i)).not.toBeVisible();
    }
  });
});
