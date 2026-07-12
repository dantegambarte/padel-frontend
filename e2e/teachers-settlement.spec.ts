import { test, expect, Page } from '@playwright/test';

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

async function goToTeacherReport(page: Page): Promise<void> {
  await page.goto('/app/teachers/report');
  await page.waitForLoadState('networkidle');
}

/**
 * Selecciona el primer profesor del combo (el "Profesor" es el primer <select>
 * del formulario de filtros) y dispara "Generar Reporte".
 * Si no hay profesores cargados, se skipea el test (no es un fallo de la suite).
 */
async function generateReportForFirstTeacher(page: Page): Promise<void> {
  const teacherSelect = page.locator('select').first();
  const optionCount = await teacherSelect.locator('option').count();
  test.skip(optionCount < 2, 'No hay profesores cargados para generar el reporte');

  await teacherSelect.selectOption({ index: 1 });

  const reportResponse = page.waitForResponse(
    (res) => /\/teachers\/.+\/report/.test(res.url()) && res.request().method() === 'GET',
    { timeout: 10_000 },
  );
  await page.getByRole('button', { name: 'Generar Reporte' }).click();
  const res = await reportResponse;
  expect(res.status()).toBe(200);
  await page.waitForLoadState('networkidle');
}

test.describe('Liquidación de Profesores — RBAC', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('TS-RBAC-01: un empleado no puede acceder a /app/teachers/report (AdminGuard)', async ({
    page,
  }) => {
    test.slow();
    await loginAsEmployee(page);

    await page.goto('/app/teachers/report');

    // AdminGuard redirige silenciosamente al dashboard cuando el rol no está autorizado.
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 8000 });
    await expect(
      page.getByRole('heading', { name: 'Liquidación de Profesores' }),
    ).not.toBeVisible();
  });
});

test.describe('Liquidación de Profesores — Rol Admin', () => {
  test.beforeEach(async ({ page }) => {
    await goToTeacherReport(page);
  });

  test('TS-01: carga la pantalla de liquidación de profesores', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Liquidación de Profesores' }),
    ).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('TS-02: genera el reporte y muestra el resumen del período', async ({ page }) => {
    await generateReportForFirstTeacher(page);

    const printArea = page.locator('#print-area');
    if (await printArea.isVisible()) {
      await expect(page.getByText('Total a liquidar')).toBeVisible();
      await expect(page.getByText('Total a Pagar')).toBeVisible();
    } else {
      await expect(
        page.getByText('Sin turnos completados en el período'),
      ).toBeVisible();
    }
  });

  test('TS-03: la tabla "Consumos Internos" lista los consumos pendientes con sus columnas', async ({
    page,
  }) => {
    await generateReportForFirstTeacher(page);

    const printArea = page.locator('#print-area');
    test.skip(!(await printArea.isVisible()), 'Profesor sin turnos completados en el período');

    const hasConsumptionsTable = await page
      .getByText('Consumos Internos', { exact: true })
      .isVisible()
      .catch(() => false);

    if (hasConsumptionsTable) {
      await expect(page.getByRole('columnheader', { name: 'Producto' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Cantidad' })).toBeVisible();
      await expect(
        page.getByRole('columnheader', { name: 'Precio Unitario' }),
      ).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Subtotal' })).toBeVisible();
      await expect(page.getByText(/TOTAL CONSUMOS/)).toBeVisible();
    }

    // El total neto siempre debe mostrarse, haya o no consumos pendientes.
    await expect(page.getByText('Total a Pagar')).toBeVisible();
  });

  test('TS-04: el modal "Liquidar Deuda Completa" muestra los consumos de cantina y los totales', async ({
    page,
  }) => {
    await generateReportForFirstTeacher(page);

    const printArea = page.locator('#print-area');
    test.skip(!(await printArea.isVisible()), 'Profesor sin turnos completados en el período');

    await page.getByRole('button', { name: 'Liquidar Deuda Completa' }).click();

    await expect(page.getByRole('heading', { name: 'Liquidar Deuda Completa' })).toBeVisible();
    await expect(page.getByText('Consumos de Cantina')).toBeVisible();
    await expect(page.getByText('Total a cobrar')).toBeVisible();
    await expect(page.locator('input[type="radio"][value="cash"]')).toBeVisible();
    await expect(page.locator('input[type="radio"][value="transfer"]')).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('TS-05: confirmar la liquidación envía la petición y resuelve con éxito o "Caja Cerrada"', async ({
    page,
  }) => {
    await generateReportForFirstTeacher(page);

    const printArea = page.locator('#print-area');
    test.skip(!(await printArea.isVisible()), 'Profesor sin turnos completados en el período');

    await page.getByRole('button', { name: 'Liquidar Deuda Completa' }).click();
    await expect(page.getByRole('heading', { name: 'Liquidar Deuda Completa' })).toBeVisible();

    const liquidateResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/teachers/liquidate') && res.request().method() === 'POST',
      { timeout: 10_000 },
    );
    await page.getByRole('button', { name: 'Confirmar Liquidación' }).click();
    const res = await liquidateResponse;

    if (res.ok()) {
      await expect(page.getByText('Liquidación registrada')).toBeVisible({ timeout: 5000 });
    } else {
      // Sin sesión de caja abierta, el backend rechaza con CAJA_CERRADA y el front
      // muestra un SweetAlert específico en lugar del toast de éxito.
      const body = await res.json().catch(() => ({}));
      expect(body.errorCode).toBe('CAJA_CERRADA');
      await expect(page.getByText(/Caja Cerrada/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test('TS-06: el botón "Imprimir / PDF" dispara la impresión del reporte', async ({ page }) => {
    await generateReportForFirstTeacher(page);

    const printArea = page.locator('#print-area');
    test.skip(!(await printArea.isVisible()), 'Profesor sin turnos completados en el período');

    const printButton = page.getByRole('button', { name: /Imprimir.*PDF/i });
    await expect(printButton).toBeVisible();

    await page.evaluate(() => {
      (window as unknown as { __printCalled: boolean }).__printCalled = false;
      window.print = () => {
        (window as unknown as { __printCalled: boolean }).__printCalled = true;
      };
    });

    await printButton.click();

    const printCalled = await page.evaluate(
      () => (window as unknown as { __printCalled: boolean }).__printCalled,
    );
    expect(printCalled).toBe(true);
  });
});
