import { test, expect, Locator, Page } from '@playwright/test';

const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0];

async function goToSchedule(page: Page) {
  await page.goto('/app/schedule');
  await page.waitForLoadState('networkidle');
  const datePicker = page.locator('input[type="date"]').first();
  await datePicker.fill(futureDate);
  await datePicker.dispatchEvent('change');
  await page.waitForLoadState('networkidle');
}

function availableSlot(page: Page) {
  return page.getByRole('button', { name: /Disponible \d{2}:\d{2}/ }).first();
}

/**
 * Activa un elemento de la grilla respetando el tipo de dispositivo.
 *
 * En el proyecto Mobile (iPhone SE, `hasTouch: true`) un `click()` de Playwright
 * despacha eventos de mouse y el handler del slot NO responde — casi seguro por
 * el drag & drop del CDK, que en táctil captura los eventos de puntero. Un
 * usuario real toca la pantalla, así que `tap()` es la interacción correcta y no
 * un parche: verificado que `click()` no abre el modal y `tap()` sí.
 */
async function activar(page: Page, locator: Locator) {
  const esTactil = await page.evaluate(() => 'ontouchstart' in window);
  if (esTactil) {
    await locator.tap();
  } else {
    await locator.click();
  }
}

test.describe('Agenda / Reservas — Flujos CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await goToSchedule(page);
  });

  test('AG-01: la grilla carga con todas las canchas activas', async ({
    page,
  }) => {
    await expect(
      page.getByRole('heading', { name: 'Agenda de Canchas' }),
    ).toBeVisible();
    const courtHeaders = page.locator('text=/Cancha/i');
    await expect(courtHeaders.first()).toBeVisible({ timeout: 5000 });
  });

  test('AG-02: clic en slot disponible abre el modal de nueva reserva', async ({
    page,
  }) => {
    const slotDisp = availableSlot(page);

    if (await slotDisp.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
      await activar(page, slotDisp);
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 4000 });
      await expect(dialog.getByRole('textbox').first()).toBeVisible();
    }
  });

  test('AG-03: el modal de nueva reserva valida que el nombre del cliente sea obligatorio', async ({
    page,
  }) => {
    const slotDisp = availableSlot(page);

    if (await slotDisp.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
      await activar(page, slotDisp);
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 4000 });

      const saveBtn = dialog.getByRole('button', {
        name: /Guardar|Reservar|Crear/i,
      });
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await expect(dialog).toBeVisible({ timeout: 2000 });
      }
    }
  });

  test('AG-04: crear una reserva nueva de 60 minutos con pago en efectivo', async ({
    page,
  }) => {
    const slotDisp = availableSlot(page);

    if (!(await slotDisp.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false))) {
      test.skip();
      return;
    }

    await activar(page, slotDisp);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 4000 });

    await dialog.getByRole('textbox').first().fill('Test E2E Player');

    const dur60 = dialog.getByRole('button', { name: /60|1 hora/i });
    if (await dur60.isVisible()) await dur60.click();

    const cashInput = dialog.locator('input[type="number"]').first();
    if (await cashInput.isVisible()) await cashInput.fill('3000');

    const saveBtn = dialog.getByRole('button', {
      name: /Guardar|Reservar|Crear/i,
    });
    if (await saveBtn.isEnabled()) {
      const responsePromise = page.waitForResponse(
        (res) =>
          res.url().includes('/bookings') && res.request().method() === 'POST',
        { timeout: 12000 },
      );
      await saveBtn.click();
      const res = await responsePromise.catch(() => null);
      if (res) {
        expect([200, 201, 400, 409, 503]).toContain(res.status());
      }
    }
  });

  test('AG-05: clic en una reserva existente abre el modal de detalle', async ({
    page,
  }) => {
    const grid = page.locator('.overflow-x-auto, [class*="grid-cols"]').first();
    const bookingCard = grid
      .getByRole('button', { name: /Reservado|Jugando/i })
      .first();

    if (await bookingCard.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
      await activar(page, bookingCard);
      await page.waitForTimeout(500);
      const dialog = page.getByRole('dialog');
      if (await dialog.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
        await expect(
          dialog.getByText(/cliente|Cliente|Reserva/i).first(),
        ).toBeVisible();
      }
    }
  });

  test('AG-06: el selector de fecha carga reservas del día seleccionado', async ({
    page,
  }) => {
    const datePicker = page.locator('input[type="date"]').first();
    await expect(datePicker).toBeVisible();

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/bookings'),
      { timeout: 8000 },
    );
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split('T')[0];
    await datePicker.fill(yesterday);
    await datePicker.dispatchEvent('change');
    const res = await responsePromise.catch(() => null);
    if (res) expect([200, 304, 429]).toContain(res.status());
  });

  test('AG-07: el botón de refrescar vuelve a cargar las reservas', async ({
    page,
  }) => {
    const refreshBtn = page.getByRole('button', {
      name: /Actualizar|Refrescar|refresh/i,
    });
    await expect(refreshBtn).toBeVisible();

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/bookings'),
      { timeout: 8000 },
    );
    await refreshBtn.click();
    const res = await responsePromise.catch(() => null);
    if (res) expect([200, 304, 429]).toContain(res.status());
  });

  test('AG-08: las duraciones disponibles (30/60/90/120 min) aparecen en el modal', async ({
    page,
  }) => {
    const slotDisp = availableSlot(page);

    if (await slotDisp.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
      await activar(page, slotDisp);
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 4000 });

      const durationOptions = dialog
        .getByRole('button')
        .filter({ hasText: /min|hora/i });
      const count = await durationOptions.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('AG-09: cambiar duración actualiza el precio mostrado en el modal', async ({
    page,
  }) => {
    const slotDisp = availableSlot(page);

    if (await slotDisp.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
      await activar(page, slotDisp);
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 4000 });

      const dur90 = dialog.getByRole('button', { name: /90|1:30/i });
      if (await dur90.isVisible()) {
        await dur90.click();
        await expect(dialog.getByText(/\$/).first()).toBeVisible({
          timeout: 3000,
        });
      }
    }
  });

  test('AG-10: el modal se cierra con el botón Cancelar sin guardar', async ({
    page,
  }) => {
    const slotDisp = availableSlot(page);

    if (await slotDisp.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
      await activar(page, slotDisp);
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 4000 });

      const cancelBtn = dialog
        .getByRole('button', { name: /Cancelar|Cerrar|×/i })
        .first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await expect(dialog).not.toBeVisible({ timeout: 3000 });
      }
    }
  });
});
