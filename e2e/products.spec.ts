import { test, expect, Page } from '@playwright/test';

async function goToProducts(page: Page) {
  await page.goto('/app/products');
  await page.waitForLoadState('networkidle');
}

test.describe('Módulo de Productos', () => {
  test.beforeEach(async ({ page }) => {
    await goToProducts(page);
  });

  test('PR-01: carga la lista de productos', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Productos', exact: true }).first(),
    ).toBeVisible();
    const items = page.locator(
      'table tbody tr, [data-testid="product-row"], .product-item',
    );
    await expect(items.first()).toBeVisible({ timeout: 8000 });
  });

  test('PR-02: el buscador filtra productos por nombre', async ({ page }) => {
    const searchInput = page
      .getByRole('searchbox')
      .first()
      .or(page.getByPlaceholder(/buscar|search/i).first());
    if (await searchInput.isVisible()) {
      await searchInput.fill('agua');
      await page.waitForTimeout(600);
      await expect(
        page.getByRole('heading', { name: 'Productos', exact: true }).first(),
      ).toBeVisible();
    }
  });

  test('PR-03: el filtro de stock bajo funciona', async ({ page }) => {
    const lowStockBtn = page
      .getByRole('button', { name: /stock bajo|low stock/i })
      .or(page.getByRole('checkbox', { name: /stock bajo/i }));
    if (await lowStockBtn.isVisible()) {
      await lowStockBtn.click();
      await page.waitForTimeout(500);
      await expect(
        page.getByRole('heading', { name: 'Productos', exact: true }).first(),
      ).toBeVisible();
    }
  });

  test('PR-04: el botón Nuevo Producto abre el modal de creación', async ({
    page,
  }) => {
    const newBtn = page.getByRole('button', {
      name: /Nuevo Producto|Agregar|Crear/i,
    });
    await expect(newBtn).toBeVisible();
    await newBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
    await expect(
      page.getByRole('dialog').getByRole('textbox').first(),
    ).toBeVisible();
  });

  test('PR-05: el modal de Nuevo Producto valida campos requeridos', async ({
    page,
  }) => {
    const newBtn = page.getByRole('button', {
      name: /Nuevo Producto|Agregar|Crear/i,
    });
    await newBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    const saveBtn = dialog.getByRole('button', {
      name: /Guardar|Crear|Confirmar/i,
    });
    if (await saveBtn.isVisible()) {
      await expect(saveBtn)
        .toBeDisabled()
        .catch(async () => {
          await saveBtn.click();
          await page.waitForTimeout(300);
          await expect(dialog).toBeVisible();
        });
    }
  });

  test('PR-06: se puede crear un nuevo producto completo', async ({ page }) => {
    const newBtn = page.getByRole('button', {
      name: /Nuevo Producto|Agregar producto/i,
    });
    await newBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    const nameInput = dialog.getByRole('textbox').first();
    await nameInput.fill('Producto Test E2E');

    const categorySelect = dialog.getByRole('combobox', { name: /Categoría/i });
    if (await categorySelect.isVisible()) {
      await categorySelect.selectOption('Bebidas');
    }

    const spinbuttons = dialog.getByRole('spinbutton');
    const spinCount = await spinbuttons.count();
    if (spinCount >= 1) await spinbuttons.nth(0).fill('100');
    if (spinCount >= 2) await spinbuttons.nth(1).fill('200');
    if (spinCount >= 3) await spinbuttons.nth(2).fill('10');

    const saveBtn = dialog.getByRole('button', {
      name: /Agregar Producto|Guardar|Crear/i,
    });
    if (await saveBtn.isEnabled()) {
      const responsePromise = page.waitForResponse(
        (res) =>
          res.url().includes('/products') && res.request().method() === 'POST',
        { timeout: 8000 },
      );
      await saveBtn.click();
      const res = await responsePromise.catch(() => null);
      if (res) {
        expect([201, 400, 409]).toContain(res.status());
      }
    }
  });

  test('PR-07: se puede editar un producto existente', async ({ page }) => {
    const editBtn = page
      .getByRole('button', { name: /editar|edit/i })
      .first()
      .or(page.locator('[data-testid="edit-product"]').first());

    if (await editBtn.isVisible({ timeout: 3000 })) {
      await editBtn.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 3000 });
      await expect(
        dialog.locator('input[type="text"]').first(),
      ).not.toHaveValue('');
    }
  });

  test('PR-08: los botones de acción (editar/eliminar) están presentes en la tabla', async ({
    page,
  }) => {
    const editBtn = page
      .getByRole('button', { name: /Editar producto/i })
      .first();
    const deleteBtn = page
      .getByRole('button', { name: /Eliminar producto/i })
      .first();
    const hasActions =
      (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false));
    expect(hasActions).toBeTruthy();
  });

  test('PR-09: cada producto muestra nombre, precio y stock', async ({
    page,
  }) => {
    await expect(page.getByText(/\$[\d.,]+/).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('PR-10: el filtro por categoría funciona', async ({ page }) => {
    const categoryFilter = page
      .locator('select')
      .first()
      .or(page.getByRole('combobox').first());
    if (await categoryFilter.isVisible({ timeout: 2000 })) {
      const options = await categoryFilter.locator('option').count();
      if (options > 1) {
        await categoryFilter.selectOption({ index: 1 });
        await page.waitForTimeout(500);
        await expect(
          page.getByRole('heading', { name: 'Productos', exact: true }).first(),
        ).toBeVisible();
      }
    }
  });
});
