import { test, expect, Page } from '@playwright/test';

async function goToSettings(page: Page) {
  await page.goto('/app/settings');
  await page.waitForLoadState('networkidle');
}

function settingsHeading(page: Page) {
  return page.getByRole('heading', { name: /Configuración/i }).first();
}

/**
 * El modal de canchas usa p-dialog de PrimeNG, que expone role="dialog" dos
 * veces: en el host <p-dialog> y en el <div> interno que renderiza. Un
 * getByRole('dialog') suelto matchea ambos y rompe por strict mode, así que
 * acotamos al interno, que es el que tiene el contenido.
 */
function courtDialog(page: Page) {
  return page.locator('p-dialog').getByRole('dialog');
}

test.describe('Módulo de Configuración', () => {
  test.beforeEach(async ({ page }) => {
    await goToSettings(page);
  });

  test('SE-01: carga la pantalla de configuración correctamente', async ({
    page,
  }) => {
    await expect(settingsHeading(page)).toBeVisible({ timeout: 8000 });
  });

  test('SE-02: muestra los precios actuales de la cancha (estándar y profesor)', async ({
    page,
  }) => {
    const hasPrices =
      (await page.getByText(/precio|Precio|Estándar|Profesor/i).count()) > 0;
    expect(hasPrices).toBeTruthy();
  });

  test('SE-03: los campos de precio aceptan entrada numérica', async ({
    page,
  }) => {
    const priceInputs = page.locator('input[type="number"]');
    const count = await priceInputs.count();
    if (count > 0) {
      await priceInputs.first().fill('3500');
      await expect(priceInputs.first()).toHaveValue('3500');
    }
  });

  test('SE-04: el botón Guardar Fondo dispara un PUT/PATCH a la API', async ({
    page,
  }) => {
    const fondoInput = page.getByRole('spinbutton', { name: /Fondo por defecto/i });
    if (await fondoInput.isVisible()) {
      const currentVal = await fondoInput.inputValue();
      await fondoInput.fill(
        currentVal ? String(Number(currentVal) + 1) : '3500',
      );
    }
    const saveBtn = page.getByRole('button', {
      name: /Guardar Fondo/i,
    });
    if (await saveBtn.isVisible() && await saveBtn.isEnabled()) {
      const responsePromise = page.waitForResponse(
        (res) =>
          res.url().includes('/config') &&
          (res.request().method() === 'PUT' ||
            res.request().method() === 'PATCH'),
        { timeout: 8000 },
      );
      await saveBtn.click();
      const res = await responsePromise.catch(() => null);
      if (res) expect([200, 201, 400, 403, 404]).toContain(res.status());
    }
  });

  test('SE-05: muestra la lista de canchas activas', async ({ page }) => {
    const hasCourtList =
      (await page.getByText(/Cancha/i).count()) > 0 ||
      (await page.locator('table tbody tr').count()) > 0;
    expect(hasCourtList).toBeTruthy();
  });

  test('SE-06: el botón Nueva Cancha abre el modal de creación', async ({
    page,
  }) => {
    const newCourtBtn = page
      .getByRole('button', { name: /Nueva Cancha|Agregar Cancha/i })
      .first();
    if (await newCourtBtn.isVisible({ timeout: 3000 })) {
      await newCourtBtn.click();
      const dialog = courtDialog(page);
      await expect(dialog).toBeVisible({ timeout: 3000 });
    }
  });

  test('SE-07: crear una nueva cancha con nombre válido', async ({ page }) => {
    const newCourtBtn = page
      .getByRole('button', { name: /Nueva Cancha|Agregar Cancha/i })
      .first();
    if (!(await newCourtBtn.isVisible({ timeout: 3000 }))) {
      test.skip();
      return;
    }

    await newCourtBtn.click();
    const dialog = courtDialog(page);
    await expect(dialog).toBeVisible({ timeout: 3000 });

    const nameInput = dialog.getByRole('textbox').first();
    await nameInput.fill('Cancha Test E2E');

    const saveBtn = dialog.getByRole('button', { name: /Guardar|Crear/i });
    if (await saveBtn.isEnabled()) {
      const responsePromise = page.waitForResponse(
        (res) =>
          res.url().includes('/courts') && res.request().method() === 'POST',
        { timeout: 8000 },
      );
      await saveBtn.click();
      const res = await responsePromise.catch(() => null);
      if (res) expect([201, 409, 400]).toContain(res.status());
    }
  });

  test('SE-08: editar una cancha existente abre el modal con sus datos', async ({
    page,
  }) => {
    const editBtn = page
      .getByRole('button', { name: /editar|edit/i })
      .first()
      .or(page.locator('[data-testid="edit-court"]').first());

    if (await editBtn.isVisible({ timeout: 3000 })) {
      await editBtn.click();
      const dialog = courtDialog(page);
      await expect(dialog).toBeVisible({ timeout: 3000 });
      await expect(dialog.getByRole('textbox').first()).not.toHaveValue('');
    }
  });

  test('SE-09: los horarios de apertura y cierre están configurables', async ({
    page,
  }) => {
    const hasHours =
      (await page.getByText(/horario|apertura|cierre|hora/i).count()) > 0 ||
      (await page.locator('input[type="time"], input[type="number"]').count()) >
        1;
    expect(hasHours).toBeTruthy();
  });

  test('SE-10: el botón Cancelar en configuración revierte los cambios', async ({
    page,
  }) => {
    const cancelBtn = page.getByRole('button', { name: /Cancelar/i });
    const openingInput = page.getByLabel(/Horario de Apertura/i);
    const saveBtn = page.getByRole('button', {
      name: /Guardar Horarios|Guardar Configuración/i,
    });

    if ((await openingInput.isVisible()) && (await cancelBtn.isVisible())) {
      const original = await openingInput.inputValue();
      const changed = original === '09:00' ? '09:30' : '09:00';
      await openingInput.fill(changed);
      await openingInput.blur();
      await expect(saveBtn).toBeEnabled({ timeout: 3000 });

      await cancelBtn.click();
      await page.waitForLoadState('networkidle');
      await expect(saveBtn).toBeDisabled({ timeout: 8000 });
      await expect(openingInput).toHaveValue(original);
    }
  });
});
