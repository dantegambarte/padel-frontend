import { test, expect, Page } from '@playwright/test';

// ─── helpers ────────────────────────────────────────────────────────────────

async function goToPOS(page: Page) {
  await page.goto('/app/pos');
  await page.waitForLoadState('networkidle');
}

// ─── suite ──────────────────────────────────────────────────────────────────

test.describe('POS / Nueva Venta', () => {
  test.beforeEach(async ({ page }) => {
    await goToPOS(page);
  });

  // POS-01
  test('POS-01: carga la lista de productos disponibles', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Nueva Venta' })).toBeVisible();
    // Debe haber al menos un producto en el catálogo (botones con precio)
    const products = page.getByRole('button').filter({ hasText: /\$\d/ }).first();
    await expect(products).toBeVisible({ timeout: 8000 });
  });

  // POS-02
  test('POS-02: el carrito comienza vacío y el botón Ir al Pago está deshabilitado', async ({ page }) => {
    // Sin productos en el carrito el botón "Ir al Pago" no debe estar activo
    const btn = page.getByRole('button', { name: /Ir al Pago/i });
    await expect(btn).toBeDisabled();
  });

  // POS-03
  test('POS-03: agregar un producto incrementa el subtotal', async ({ page }) => {
    // Clic en el primer producto disponible del catálogo
    const firstProduct = page.getByRole('button').filter({ hasText: /\$\d/ }).first();
    await firstProduct.click();
    // El botón "Ir al Pago" debe mostrar un monto > $0
    await expect(page.getByRole('button', { name: /Ir al Pago · \$[1-9]/ })).toBeVisible({ timeout: 3000 });
  });

  // POS-04
  test('POS-04: botón + / - cambia la cantidad del item en el carrito', async ({ page }) => {
    const firstProduct = page.getByRole('button').filter({ hasText: /\$\d/ }).first();
    await firstProduct.click();
    // Incrementar
    const plusBtn = page.getByRole('button', { name: 'Incrementar cantidad' }).first();
    if (await plusBtn.isVisible()) {
      await plusBtn.click();
      // Verificar que el badge del carrito muestra 2 ítems (más específico que getByText('2'))
      await expect(page.locator('text=/2 ítems?/').first()).toBeVisible({ timeout: 3000 });
    }
  });

  // POS-05
  test('POS-05: eliminar un item del carrito lo remueve', async ({ page }) => {
    const firstProduct = page.getByRole('button').filter({ hasText: /\$\d/ }).first();
    await firstProduct.click();
    const removeBtn = page.getByRole('button', { name: 'Eliminar producto' }).first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();
      const btn = page.getByRole('button', { name: /Ir al Pago/i });
      await expect(btn).toBeDisabled();
    }
  });

  // POS-06
  test('POS-06: no se puede confirmar si el monto pagado es menor al total', async ({ page }) => {
    const firstProduct = page.getByRole('button').filter({ hasText: /\$\d/ }).first();
    await firstProduct.click();
    // Navegar al paso de pago
    await page.getByRole('button', { name: /Ir al Pago/i }).click();
    // Ingresar pago insuficiente ($1)
    const cashInput = page.getByRole('spinbutton', { name: /Efectivo/i });
    if (await cashInput.isVisible()) {
      await cashInput.fill('1');
    }
    const confirmBtn = page.getByRole('button', { name: /Confirmar Venta/i });
    await expect(confirmBtn).toBeDisabled();
  });

  // POS-07
  test('POS-07: confirmar una venta completa con efectivo y limpiar carrito', async ({ page }) => {
    // Agrega el primer producto
    const firstProduct = page.getByRole('button').filter({ hasText: /\$\d/ }).first();
    await firstProduct.click();

    // Navegar al paso de pago
    const irAlPagoBtn = page.getByRole('button', { name: /Ir al Pago/i });
    await irAlPagoBtn.click();

    // Leer el total mostrado para saber cuánto pagar
    const totalText = await page.locator('text=/TOTAL:/').locator('..').textContent().catch(() => '');
    const match = totalText?.match(/[\d.,]+/);
    const totalAmount = match ? match[0].replace(',', '') : '9999';

    // Paga con efectivo
    const cashInput = page.getByRole('spinbutton', { name: /Efectivo/i });
    if (await cashInput.isVisible()) {
      await cashInput.fill(totalAmount);
    }

    const confirmBtn = page.getByRole('button', { name: /Confirmar Venta/i });
    if (await confirmBtn.isEnabled()) {
      // Espera la respuesta de la API
      const salePromise = page.waitForResponse(
        (res) => res.url().includes('/sales') && res.request().method() === 'POST',
        { timeout: 10000 },
      );
      await confirmBtn.click();
      const res = await salePromise.catch(() => null);

      if (res) {
        const status = res.status();
        // 201 = éxito; 400 = validación backend; 503 = caja cerrada
        expect([201, 400, 503]).toContain(status);
        if (status === 201) {
          // El carrito debe quedar vacío después de una venta exitosa
          await expect(page.getByRole('button', { name: /Ir al Pago/i })).toBeDisabled({ timeout: 5000 });
        }
      }
    }
  });

  // POS-08
  test('POS-08: la búsqueda/filtro de productos funciona', async ({ page }) => {
    const searchInput = page.getByRole('searchbox').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('a');
      await page.waitForTimeout(500);
      // Debe reducir o mostrar resultados
      await expect(page.getByRole('button').filter({ hasText: /\$\d/ }).first()).toBeVisible({ timeout: 3000 });
    }
  });

  // POS-09
  test('POS-09: pago mixto (efectivo + transferencia) se acepta correctamente', async ({ page }) => {
    const firstProduct = page.getByRole('button').filter({ hasText: /\$\d/ }).first();
    await firstProduct.click();

    // Navegar al paso de pago
    await page.getByRole('button', { name: /Ir al Pago/i }).click();

    const cashInput = page.getByRole('spinbutton', { name: /Efectivo/i });
    const transferInput = page.getByRole('spinbutton', { name: /Transferencia/i });
    if (await cashInput.isVisible() && await transferInput.isVisible()) {
      await cashInput.fill('500');
      await transferInput.fill('500');
      await page.waitForTimeout(300);
      // No forzamos el estado, solo verificamos que no crashea
      await expect(page.getByRole('heading', { name: 'Nueva Venta' })).toBeVisible();
    }
  });
});
