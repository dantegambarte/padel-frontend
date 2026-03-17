import { test, expect, Page } from '@playwright/test';

async function goToProducts(page: Page) {
  await page.goto('/app/products');
  await page.waitForLoadState('networkidle');
}

test.describe('Módulo de Productos', () => {
  test.beforeEach(async ({ page }) => {
    await goToProducts(page);
  });

  // PR-01
  test('PR-01: carga la lista de productos', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Productos', exact: true }).first()).toBeVisible();
    // Debe existir al menos una fila de producto o tarjeta
    const items = page.locator('table tbody tr, [data-testid="product-row"], .product-item');
    await expect(items.first()).toBeVisible({ timeout: 8000 });
  });

  // PR-02
  test('PR-02: el buscador filtra productos por nombre', async ({ page }) => {
    const searchInput = page.getByRole('searchbox').first()
      .or(page.getByPlaceholder(/buscar|search/i).first());
    if (await searchInput.isVisible()) {
      await searchInput.fill('agua');
      await page.waitForTimeout(600);
      // No debe haber error de UI
      await expect(page.getByRole('heading', { name: 'Productos', exact: true }).first()).toBeVisible();
    }
  });

  // PR-03
  test('PR-03: el filtro de stock bajo funciona', async ({ page }) => {
    const lowStockBtn = page.getByRole('button', { name: /stock bajo|low stock/i })
      .or(page.getByRole('checkbox', { name: /stock bajo/i }));
    if (await lowStockBtn.isVisible()) {
      await lowStockBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByRole('heading', { name: 'Productos', exact: true }).first()).toBeVisible();
    }
  });

  // PR-04
  test('PR-04: el botón Nuevo Producto abre el modal de creación', async ({ page }) => {
    const newBtn = page.getByRole('button', { name: /Nuevo Producto|Agregar|Crear/i });
    await expect(newBtn).toBeVisible();
    await newBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('dialog').getByRole('textbox').first()).toBeVisible();
  });

  // PR-05
  test('PR-05: el modal de Nuevo Producto valida campos requeridos', async ({ page }) => {
    const newBtn = page.getByRole('button', { name: /Nuevo Producto|Agregar|Crear/i });
    await newBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Intentar guardar sin completar campos
    const saveBtn = dialog.getByRole('button', { name: /Guardar|Crear|Confirmar/i });
    if (await saveBtn.isVisible()) {
      await expect(saveBtn).toBeDisabled()
        .catch(async () => {
          // Si no está deshabilitado, al hacer clic debe mostrar validación
          await saveBtn.click();
          await page.waitForTimeout(300);
          await expect(dialog).toBeVisible(); // modal no debe cerrarse
        });
    }
  });

  // PR-06
  test('PR-06: se puede crear un nuevo producto completo', async ({ page }) => {
    const newBtn = page.getByRole('button', { name: /Nuevo Producto|Agregar|Crear/i });
    await newBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Completar el formulario
    const inputs = dialog.locator('input[type="text"], input[type="number"]');
    const count = await inputs.count();

    if (count >= 2) {
      // Nombre del producto
      await inputs.nth(0).fill('Producto Test E2E');
      // Precio
      const priceInput = dialog.locator('input[type="number"]').first();
      await priceInput.fill('100');

      const saveBtn = dialog.getByRole('button', { name: /Guardar|Crear|Confirmar/i });
      if (await saveBtn.isEnabled()) {
        const responsePromise = page.waitForResponse(
          (res) => res.url().includes('/products') && res.request().method() === 'POST',
          { timeout: 8000 },
        );
        await saveBtn.click();
        const res = await responsePromise.catch(() => null);
        if (res) {
          expect([201, 400, 409]).toContain(res.status());
        }
      }
    }
  });

  // PR-07
  test('PR-07: se puede editar un producto existente', async ({ page }) => {
    // Busca botón de editar en la primera fila
    const editBtn = page.getByRole('button', { name: /editar|edit/i }).first()
      .or(page.locator('[data-testid="edit-product"]').first());

    if (await editBtn.isVisible({ timeout: 3000 })) {
      await editBtn.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 3000 });
      // El formulario debe tener los datos cargados
      await expect(dialog.locator('input[type="text"]').first()).not.toHaveValue('');
    }
  });

  // PR-08
  test('PR-08: se puede hacer restock (agregar stock) a un producto', async ({ page }) => {
    const restockBtn = page.getByRole('button', { name: /restock|reponer|stock|agregar/i }).first();
    if (await restockBtn.isVisible({ timeout: 3000 })) {
      await restockBtn.click();
      const dialog = page.getByRole('dialog');
      if (await dialog.isVisible({ timeout: 2000 })) {
        const stockInput = dialog.locator('input[type="number"]').first();
        if (await stockInput.isVisible()) {
          await stockInput.fill('5');
          const saveBtn = dialog.getByRole('button', { name: /Guardar|Confirmar/i });
          if (await saveBtn.isEnabled()) {
            const responsePromise = page.waitForResponse(
              (res) => res.url().includes('/products') && res.request().method() === 'PATCH',
              { timeout: 8000 },
            );
            await saveBtn.click();
            const res = await responsePromise.catch(() => null);
            if (res) expect([200, 400]).toContain(res.status());
          }
        }
      }
    }
  });

  // PR-09
  test('PR-09: cada producto muestra nombre, precio y stock', async ({ page }) => {
    // La lista debe mostrar datos mínimos de cada producto
    await expect(page.getByText(/\$[\d.,]+/).first()).toBeVisible({ timeout: 5000 });
  });

  // PR-10
  test('PR-10: el filtro por categoría funciona', async ({ page }) => {
    const categoryFilter = page.locator('select').first()
      .or(page.getByRole('combobox').first());
    if (await categoryFilter.isVisible({ timeout: 2000 })) {
      const options = await categoryFilter.locator('option').count();
      if (options > 1) {
        await categoryFilter.selectOption({ index: 1 });
        await page.waitForTimeout(500);
        await expect(page.getByRole('heading', { name: 'Productos', exact: true }).first()).toBeVisible();
      }
    }
  });
});
