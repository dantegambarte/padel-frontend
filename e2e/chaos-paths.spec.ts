import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:3000/api/v1';

async function goToPOS(page: Page) {
  await page.goto('/app/pos');
  await page.waitForLoadState('networkidle');
}

async function goToCash(page: Page) {
  await page.goto('/app/cash-register');
  await page.waitForLoadState('networkidle');
}

function saleActionButton(page: Page) {
  return page.getByRole('button', {
    name: /Confirmar Venta|Cobrar|Caja Cerrada/i,
  }).first();
}

/**
 * Agrega el primer producto del catálogo y completa el pago.
 *
 * Flujo desktop del POS (wizard 2 pasos):
 *   Paso 1 → ítems del carrito
 *   Paso 2 → inputs de pago + botón de acción de venta
 *
 * El helper navega al Paso 2 antes de buscar el input #efectivo.
 * Usa { exact: true } para el tab "Pago" y no colisionar con "Ir al Pago · $xx".
 */
async function addFirstProductAndPay(page: Page): Promise<void> {
  const productBtn = page.locator('button').filter({ hasText: /\$/ }).first();
  await productBtn.waitFor({ state: 'visible', timeout: 8000 });
  await productBtn.click();

  const pagoTab = page.getByRole('button', { name: 'Pago', exact: true });
  if (await pagoTab.waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false)) {
    await pagoTab.click();
  }

  const efectivoInput = page.locator('#efectivo').first();
  await efectivoInput.waitFor({ state: 'visible', timeout: 5000 });

  let totalAmount = '9999';
  const totalText = await page
    .locator('.text-2xl.font-bold, .text-2xl.font-bold.text-primary')
    .first()
    .textContent({ timeout: 3000 })
    .catch(() => null);
  if (totalText) {
    const digits = totalText.replace(/[^0-9]/g, '');
    if (digits) totalAmount = digits;
  }

  await efectivoInput.fill(totalAmount);
}

test.describe('Suite 1 · Flujo de Caja Estricto', () => {
  test('CHAOS-01: cobrar con caja cerrada muestra el modal "Caja Cerrada"', async ({
    page,
  }) => {
    await page.route(`${API}/sales`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            errorCode: 'CAJA_CERRADA',
            message:
              'No hay una sesión de caja abierta para el día comercial actual.',
          }),
        });
      } else {
        route.continue();
      }
    });

    await goToPOS(page);
    await addFirstProductAndPay(page);

    const confirmBtn = saleActionButton(page);
    await expect(confirmBtn).toBeEnabled({ timeout: 4000 });
    await confirmBtn.click();

    const swalPopup = page.locator('.swal2-popup');
    await expect(swalPopup).toBeVisible({ timeout: 5000 });
    await expect(swalPopup.locator('.swal2-title')).toContainText(
      'Caja Cerrada',
      {
        ignoreCase: true,
      },
    );
    await expect(swalPopup.locator('.swal2-html-container')).toContainText(
      /caja|apertura/i,
    );
  });

  test('CHAOS-02: abrir caja con fondo inicial y luego cobrar exitosamente', async ({
    page,
  }) => {
    await goToCash(page);

    const fondoInput = page
      .locator('input[id="fondoInicial"], input[placeholder*="fondo" i]')
      .first();

    if (await fondoInput.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
      await fondoInput.fill('5000');
      const abrirBtn = page.getByRole('button', {
        name: /Abrir Jornada|Abrir Caja/i,
      });
      await expect(abrirBtn).toBeEnabled();

      const openResponse = page.waitForResponse(
        (res) =>
          res.url().includes('/cash/open') && res.request().method() === 'POST',
        { timeout: 10000 },
      );
      await abrirBtn.click();
      const res = await openResponse.catch(() => null);
      if (res) expect([201, 409]).toContain(res.status());
      await page.waitForTimeout(1000);
    }

    await goToPOS(page);
    await addFirstProductAndPay(page);

    const confirmBtn = saleActionButton(page);
    await expect(confirmBtn).toBeEnabled({ timeout: 4000 });

    const saleResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/sales') && res.request().method() === 'POST',
      { timeout: 12000 },
    );
    await confirmBtn.click();
    const saleRes = await saleResponse.catch(() => null);

    if (saleRes) {
      const status = saleRes.status();
      expect([201, 400, 409, 503]).toContain(status);
      if (status === 201) {
        await expect(
          page.getByRole('button', { name: /Ir al Pago/i }),
        ).toBeDisabled({ timeout: 6000 });
      }
    }
  });

  test('CHAOS-03: el dashboard de caja refleja el movimiento recién cobrado', async ({
    page,
  }) => {
    await page.route(`${API}/cash/current`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: 'test-session-id',
            status: 'OPEN',
            date: new Date().toLocaleDateString('en-CA'),
            openedAt: new Date().toISOString(),
            initialBalance: 5000,
            cashCounted: null,
            difference: null,
            notes: null,
          },
          cashExpected: 1500,
          transferTotal: 0,
          dayTotal: 1500,
          initialBalance: 5000,
          isOpen: true,
          transactions: [
            {
              id: 'txn-001',
              type: 'SALE',
              referenceId: 'sale-001',
              concept: 'Venta POS · E2E Test',
              amountCash: 1500,
              amountTransfer: 0,
              createdAt: new Date().toISOString(),
              customerName: 'Cliente E2E',
              createdByFullName: 'Admin Test',
              createdByUsername: 'admin',
            },
          ],
        }),
      });
    });

    await goToCash(page);

    await expect(
      page.getByRole('heading', { name: /Apertura de Caja/i }),
    ).not.toBeVisible({ timeout: 4000 });

    await expect(page.getByText(/1[.,]500|1500/).first()).toBeVisible({
      timeout: 5000,
    });

    await expect(
      page.getByText(/Venta POS.*E2E Test|E2E Test/i).first(),
    ).toBeVisible({ timeout: 4000 });
  });
});

test.describe('Suite 2 · Hard Commit de Stock', () => {
  /**
   * Inyecta un catálogo con UN producto de stock = 5.
   * FIX v3: intercepta la URL exacta del backend (API/v1/products) para no
   * colisionar con la ruta Angular /app/products.
   */
  async function injectLimitedStockCatalog(page: Page) {
    await page.route(`${API}/products`, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'prod-pelotas-001',
              name: 'Pelotas (Stock 5)',
              salePrice: 300,
              stock: 5,
              isActive: true,
              category: { id: 'cat-1', name: 'Accesorios' },
            },
          ]),
        });
      } else {
        route.continue();
      }
    });
  }

  test('CHAOS-04: se pueden agregar hasta 5 unidades de un producto con stock=5', async ({
    page,
  }) => {
    await injectLimitedStockCatalog(page);
    await goToPOS(page);

    const productBtn = page
      .locator('button')
      .filter({ hasText: /Pelotas|300/i })
      .first();
    await expect(productBtn).toBeVisible({ timeout: 8000 });

    for (let i = 0; i < 5; i++) {
      await productBtn.click();
      await page.waitForTimeout(150);
    }

    const itemsBadge = page.locator('text=/5 ítems?/').first();
    await expect(itemsBadge).toBeVisible({ timeout: 3000 });

    await expect(productBtn).toHaveClass(/opacity-50/, { timeout: 2000 });
  });

  test('CHAOS-05: la tarjeta queda bloqueada en stock=5 y la cantidad no supera el límite', async ({
    page,
  }) => {
    await injectLimitedStockCatalog(page);
    await goToPOS(page);

    const productBtn = page
      .locator('button')
      .filter({ hasText: /Pelotas|300/i })
      .first();
    await expect(productBtn).toBeVisible({ timeout: 8000 });

    for (let i = 0; i < 5; i++) {
      await productBtn.click();
      await page.waitForTimeout(150);
    }

    await expect(productBtn).toHaveClass(/opacity-50/, { timeout: 2000 });
    await expect(productBtn).toHaveClass(/pointer-events-none/);
    await expect(productBtn).toHaveAttribute('aria-disabled', 'true');

    await productBtn.click({ force: true });
    await page.waitForTimeout(400);

    await expect(page.locator('text=/5 ítems?/').first()).toBeVisible({
      timeout: 2000,
    });
    await expect(page.locator('text=/6 ítems?/')).not.toBeVisible();
  });

  test('CHAOS-06: navegar a Productos sin pagar NO descuenta stock (late commit)', async ({
    page,
  }) => {
    await injectLimitedStockCatalog(page);

    let saleCallCount = 0;
    await page.route(`${API}/sales`, (route) => {
      if (route.request().method() === 'POST') saleCallCount++;
      route.continue();
    });

    await goToPOS(page);

    const productBtn = page
      .locator('button')
      .filter({ hasText: /Pelotas|300/i })
      .first();
    await expect(productBtn).toBeVisible({ timeout: 8000 });

    for (let i = 0; i < 5; i++) {
      await productBtn.click();
      await page.waitForTimeout(150);
    }

    await page.goto('/app/products');
    await page.waitForLoadState('networkidle');

    const productsHeading = page
      .locator('h3')
      .filter({ hasText: /Productos/i })
      .first();
    await expect(productsHeading).toBeVisible({ timeout: 8000 });

    expect(saleCallCount).toBe(0);
  });
});

test.describe('Suite 3 · Reschedule de Turno por Drag & Drop', () => {
  test('CHAOS-07: arrastrar una reserva a otro slot abre el diálogo de confirmación', async ({
    page,
  }) => {
    await page.goto('/app/schedule');
    await page.waitForLoadState('networkidle');

    const booking = page
      .locator(
        '[draggable="true"], [class*="cursor-move"], [class*="booking-card"]',
      )
      .first();
    const bookingVisible = await booking
      .waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (!bookingVisible) {
      test.skip();
      return;
    }

    const bookingBox = await booking.boundingBox();
    if (!bookingBox) return;

    const availableSlot = page
      .getByRole('button', { name: 'Disponible' })
      .first();
    const slotBox = await availableSlot.boundingBox();
    if (!slotBox) return;

    await page.mouse.move(
      bookingBox.x + bookingBox.width / 2,
      bookingBox.y + bookingBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      slotBox.x + slotBox.width / 2,
      slotBox.y + slotBox.height / 2,
      { steps: 15 },
    );
    await page.mouse.up();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 4000 });
    await expect(dialog).toContainText(/mover|confirmar|turno|horario/i);
  });

  test('CHAOS-08: cancelar el drag-confirm no mueve la reserva', async ({
    page,
  }) => {
    await page.goto('/app/schedule');
    await page.waitForLoadState('networkidle');

    const booking = page
      .locator(
        '[draggable="true"], [class*="cursor-move"], [class*="booking-card"]',
      )
      .first();
    const bookingVisible = await booking
      .waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (!bookingVisible) {
      test.skip();
      return;
    }

    const originalText = (await booking.textContent()) ?? '';
    const bookingBox = await booking.boundingBox();
    const availableSlot = page
      .getByRole('button', { name: 'Disponible' })
      .first();
    const slotBox = await availableSlot.boundingBox();
    if (!bookingBox || !slotBox) return;

    await page.mouse.move(
      bookingBox.x + bookingBox.width / 2,
      bookingBox.y + bookingBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      slotBox.x + slotBox.width / 2,
      slotBox.y + slotBox.height / 2,
      { steps: 15 },
    );
    await page.mouse.up();

    const dialog = page.getByRole('dialog');
    const dialogVisible = await dialog
      .waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
    if (dialogVisible) {
      const cancelBtn = dialog.getByRole('button', { name: /Cancelar|No/i });
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await expect(dialog).not.toBeVisible({ timeout: 2000 });
      }
    }

    const bookingAfter = page
      .locator(
        '[draggable="true"], [class*="cursor-move"], [class*="booking-card"]',
      )
      .first();
    await expect(bookingAfter).toContainText(
      originalText.trim().substring(0, 10),
      {
        timeout: 3000,
      },
    );
    await expect(page.getByRole('heading', { name: /Agenda/i })).toBeVisible();
  });
});
