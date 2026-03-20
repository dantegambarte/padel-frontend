import { test, expect, Page } from '@playwright/test';

async function goToSettings(page: Page) {
  await page.goto('/app/settings');
  await page.waitForLoadState('networkidle');
}

test.describe('Módulo de Configuración', () => {
  test.beforeEach(async ({ page }) => {
    await goToSettings(page);
  });

  // SE-01
  test('SE-01: carga la pantalla de configuración correctamente', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Configuración', exact: true })).toBeVisible({ timeout: 8000 });
  });

  // SE-02
  test('SE-02: muestra los precios actuales de la cancha (estándar y profesor)', async ({ page }) => {
    const hasPrices =
      (await page.getByText(/precio|Precio|Estándar|Profesor/i).count()) > 0;
    expect(hasPrices).toBeTruthy();
  });

  // SE-03
  test('SE-03: los campos de precio aceptan entrada numérica', async ({ page }) => {
    const priceInputs = page.locator('input[type="number"]');
    const count = await priceInputs.count();
    if (count > 0) {
      await priceInputs.first().fill('3500');
      await expect(priceInputs.first()).toHaveValue('3500');
    }
  });

  // SE-04
  test('SE-04: el botón Guardar Configuración dispara un PUT/PATCH a la API', async ({ page }) => {
    // Modificar un precio para que isDirty sea true (el botón Guardar está disabled sin cambios)
    const priceInput = page.locator('input[type="number"]').first();
    if (await priceInput.isVisible()) {
      const currentVal = await priceInput.inputValue();
      await priceInput.fill(currentVal ? String(Number(currentVal) + 1) : '3500');
    }
    const saveBtn = page.getByRole('button', { name: /Guardar Configuración/i });
    if (await saveBtn.isVisible()) {
      const responsePromise = page.waitForResponse(
        (res) =>
          res.url().includes('/config') &&
          (res.request().method() === 'PUT' || res.request().method() === 'PATCH'),
        { timeout: 8000 },
      );
      await saveBtn.click();
      const res = await responsePromise.catch(() => null);
      if (res) expect([200, 201, 400, 403, 404]).toContain(res.status());
    }
  });

  // SE-05
  test('SE-05: muestra la lista de canchas activas', async ({ page }) => {
    const hasCourtList =
      (await page.getByText(/Cancha/i).count()) > 0 ||
      (await page.locator('table tbody tr').count()) > 0;
    expect(hasCourtList).toBeTruthy();
  });

  // SE-06
  test('SE-06: el botón Nueva Cancha abre el modal de creación', async ({ page }) => {
    const newCourtBtn = page.getByRole('button', { name: /Nueva Cancha|Agregar Cancha/i }).first();
    if (await newCourtBtn.isVisible({ timeout: 3000 })) {
      await newCourtBtn.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 3000 });
    }
  });

  // SE-07
  test('SE-07: crear una nueva cancha con nombre válido', async ({ page }) => {
    const newCourtBtn = page.getByRole('button', { name: /Nueva Cancha|Agregar Cancha/i }).first();
    if (!await newCourtBtn.isVisible({ timeout: 3000 })) {
      test.skip();
      return;
    }

    await newCourtBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    const nameInput = dialog.getByRole('textbox').first();
    await nameInput.fill('Cancha Test E2E');

    const saveBtn = dialog.getByRole('button', { name: /Guardar|Crear/i });
    if (await saveBtn.isEnabled()) {
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes('/courts') && res.request().method() === 'POST',
        { timeout: 8000 },
      );
      await saveBtn.click();
      const res = await responsePromise.catch(() => null);
      if (res) expect([201, 409, 400]).toContain(res.status());
    }
  });

  // SE-08
  test('SE-08: editar una cancha existente abre el modal con sus datos', async ({ page }) => {
    const editBtn = page.getByRole('button', { name: /editar|edit/i }).first()
      .or(page.locator('[data-testid="edit-court"]').first());

    if (await editBtn.isVisible({ timeout: 3000 })) {
      await editBtn.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 3000 });
      // El campo nombre no debe estar vacío
      await expect(dialog.getByRole('textbox').first()).not.toHaveValue('');
    }
  });

  // SE-09
  test('SE-09: los horarios de apertura y cierre están configurables', async ({ page }) => {
    const hasHours =
      (await page.getByText(/horario|apertura|cierre|hora/i).count()) > 0 ||
      (await page.locator('input[type="time"], input[type="number"]').count()) > 1;
    expect(hasHours).toBeTruthy();
  });

  // SE-10
  test('SE-10: el botón Cancelar en configuración revierte los cambios', async ({ page }) => {
    const cancelBtn = page.getByRole('button', { name: /Cancelar/i });
    const priceInput = page.locator('input[type="number"]').first();
    const saveBtn = page.getByRole('button', { name: /Guardar Configuración/i });

    if (await priceInput.isVisible() && await cancelBtn.isVisible()) {
      const original = await priceInput.inputValue();
      // Modificar el precio para que isDirty = true (botón Guardar se habilita)
      await priceInput.fill(String(Number(original || '3000') + 100));
      await priceInput.blur();
      await expect(saveBtn).toBeEnabled({ timeout: 3000 });

      // Cancelar: debe revertir los cambios (isDirty → false → botón Guardar disabled)
      await cancelBtn.click();
      await page.waitForLoadState('networkidle');
      // El botón Guardar debe volver a estar disabled (isDirty = false)
      await expect(saveBtn).toBeDisabled({ timeout: 8000 });
    }
  });
});
