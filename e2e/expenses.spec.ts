import { test, expect, Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Hace login como empleado desde la pantalla de login.
 * Los tests de empleado deben llamar a esto con `test.use({ storageState: … })`
 * limpio para no heredar la sesión de admin del global-setup.
 */
async function loginAsEmployee(page: Page): Promise<void> {
  await page.goto('/auth/login');
  await page.getByRole('textbox', { name: 'Usuario' }).fill('empleado');
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('empleado123');
  const loginDone = page.waitForResponse(
    (res) => res.url().includes('/auth') && res.status() === 200,
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await loginDone.catch(() => {});
  await page.waitForURL(/\/app\//, { timeout: 10_000 });
}

/** Navega a Egresos y espera carga completa. */
async function goToExpenses(page: Page): Promise<void> {
  await page.goto('/app/expenses');
  await page.waitForLoadState('networkidle');
}

/**
 * Abre el modal "Nuevo Egreso" y llena los campos básicos.
 * Usa Transferencia por defecto para evitar la dependencia de caja abierta.
 */
async function fillExpenseForm(
  page: Page,
  opts: { amount?: string; description?: string; category?: string } = {},
): Promise<void> {
  await page.getByRole('button', { name: 'Nuevo Egreso' }).click();
  await expect(page.locator('#amount')).toBeVisible();
  await page.locator('#amount').fill(opts.amount ?? '500');
  await page.locator('#description').fill(opts.description ?? 'Gasto de prueba E2E');
  if (opts.category) {
    await page.locator('#category').selectOption(opts.category);
  }
  await page.locator('#paymentMethod').selectOption('Transferencia');
}

// ─── Suite: ROL EMPLEADO ──────────────────────────────────────────────────────

test.describe('Egresos — Rol Empleado', () => {
  // Limpiar el storageState del admin para poder hacer login como empleado.
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    // El login agrega latencia de red — triplicar el timeout del test.
    test.slow();
    await loginAsEmployee(page);
    await goToExpenses(page);
  });

  // EG-E-01 ─────────────────────────────────────────────────────────────────
  test('EG-E-01: los filtros de fechas históricas no son visibles para el empleado', async ({ page }) => {
    // Los date-pickers (Desde / Hasta) están dentro de un bloque *ngIf="isAdmin".
    // No deben existir en el DOM cuando el rol es 'employee'.
    const datepickers = page.locator('input[type="date"]');
    await expect(datepickers).toHaveCount(0);
  });

  // EG-E-02 ─────────────────────────────────────────────────────────────────
  test('EG-E-02: la categoría "Sueldos" no existe en el dropdown del formulario', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuevo Egreso' }).click();
    const categorySelect = page.locator('#category');
    await expect(categorySelect).toBeVisible();
    // Ninguna opción del <select> debe contener el texto 'Sueldos'.
    await expect(categorySelect).not.toContainText('Sueldos');
  });

  // EG-E-03 ─────────────────────────────────────────────────────────────────
  test('EG-E-03: happy path — el empleado registra un egreso de Insumos exitosamente', async ({ page }) => {
    await fillExpenseForm(page, {
      amount: '500',
      description: 'Compra de pelotas E2E',
      category: 'Insumos',
    });

    const saveResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/expenses') &&
        res.request().method() === 'POST',
      { timeout: 10_000 },
    );
    await page.getByRole('button', { name: 'Registrar Egreso' }).click();
    const res = await saveResponse;

    expect(res.status()).toBe(201);

    // Esperar el GET de refresco que dispara onSaved → loadExpenses().
    await page.waitForResponse(
      (res) =>
        res.url().includes('/expenses') &&
        res.request().method() === 'GET',
      { timeout: 8_000 },
    );

    // Scope a tbody para evitar colisión con las tarjetas mobile (md:hidden).
    await expect(
      page.locator('tbody').getByText('Compra de pelotas E2E').first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  // EG-E-04 ─────────────────────────────────────────────────────────────────
  test('EG-E-04: el backend rechaza con 403 un POST con category="Sueldos" manipulado', async ({ page }) => {
    // Interceptar el POST a /expenses y forzar category = 'Sueldos' en el payload.
    await page.route('**/expenses', async (route) => {
      if (route.request().method() === 'POST') {
        const original = JSON.parse(route.request().postData() ?? '{}');
        await route.continue({
          postData: JSON.stringify({ ...original, category: 'Sueldos' }),
        });
      } else {
        await route.continue();
      }
    });

    await fillExpenseForm(page, {
      amount: '100',
      description: 'Intento forzado Sueldos',
    });

    const saveResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/expenses') &&
        res.request().method() === 'POST',
      { timeout: 10_000 },
    );
    await page.getByRole('button', { name: 'Registrar Egreso' }).click();
    const res = await saveResponse;

    // El backend debe rechazar la petición con 403 Forbidden.
    expect(res.status()).toBe(403);

    // La UI debe mostrar el mensaje de error devuelto por el backend.
    await expect(
      page.getByText(/permisos suficientes|categoría administrativa/i),
    ).toBeVisible({ timeout: 3_000 });

    // El egreso NO debe aparecer en la lista (el modal sigue abierto, cerrarlo y verificar).
    await page.getByRole('button', { name: 'Cancelar' }).first().click();
    await expect(page.getByText('Intento forzado Sueldos')).not.toBeVisible();
  });
});

// ─── Suite: ROL ADMINISTRADOR ─────────────────────────────────────────────────

test.describe('Egresos — Rol Administrador', () => {
  // Usa el storageState de admin guardado por global-setup.ts (sin override).

  test.beforeEach(async ({ page }) => {
    await goToExpenses(page);
  });

  // EG-A-01 ─────────────────────────────────────────────────────────────────
  test('EG-A-01: los filtros de fecha y la columna "Responsable" son visibles', async ({ page }) => {
    // El admin debe ver los date-pickers de Desde y Hasta.
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator('input[type="date"]').nth(1)).toBeVisible();

    // La tabla debe tener una columna encabezada "Responsable" (solo con datos cargados).
    // Si no hay egresos el día de hoy, la tabla no se renderiza — verificamos el heading.
    const hasTable = (await page.locator('table').count()) > 0;
    if (hasTable) {
      await expect(
        page.getByRole('columnheader', { name: /Responsable/i }),
      ).toBeVisible();
    } else {
      // Sin datos: al menos la interfaz debe cargar sin errores.
      await expect(page.getByRole('heading', { name: 'Egresos' })).toBeVisible();
    }
  });

  // EG-A-02 ─────────────────────────────────────────────────────────────────
  test('EG-A-02: la categoría "Sueldos" sí está disponible en el dropdown del admin', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuevo Egreso' }).click();
    const categorySelect = page.locator('#category');
    await expect(categorySelect).toBeVisible();
    await expect(categorySelect).toContainText('Sueldos');
  });

  // EG-A-03 ─────────────────────────────────────────────────────────────────
  test('EG-A-03: happy path — el admin registra Sueldos y aparece con badge morado', async ({ page }) => {
    await fillExpenseForm(page, {
      amount: '80000',
      description: 'Sueldo mensual E2E',
      category: 'Sueldos',
    });

    const saveResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/expenses') &&
        res.request().method() === 'POST',
      { timeout: 10_000 },
    );
    await page.getByRole('button', { name: 'Registrar Egreso' }).click();
    const res = await saveResponse;

    expect(res.status()).toBe(201);

    // Esperar el GET de refresco que dispara onSaved → loadExpenses().
    await page.waitForResponse(
      (res) =>
        res.url().includes('/expenses') &&
        res.request().method() === 'GET',
      { timeout: 8_000 },
    );

    // Scope a tbody para evitar colisión con las tarjetas mobile (md:hidden).
    await expect(
      page.locator('tbody').getByText('Sueldo mensual E2E').first(),
    ).toBeVisible({ timeout: 5_000 });

    // La celda de Responsable de esa fila debe tener el badge morado (bg-purple-100).
    // Restringir a tbody para no capturar la tarjeta mobile duplicada.
    const row = page.locator('tbody tr', { hasText: 'Sueldo mensual E2E' }).first();
    await expect(row.locator('span.bg-purple-100')).toBeVisible();
  });
});
