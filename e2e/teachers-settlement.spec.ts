import { test, expect, Page } from '@playwright/test';

const API_URL = 'http://localhost:3000/api/v1';
const TOKEN_KEY = 'padelsys_access_token';

/** Lee el JWT de la sesión actual desde localStorage para llamar a la API directamente. */
async function getAuthToken(page: Page): Promise<string> {
  const token = await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY);
  if (!token) throw new Error('No hay token de sesión en localStorage — ¿la página está logueada?');
  return token;
}

/**
 * Crea un turno de profesor DESCARTABLE, ya en estado COMPLETED y sin
 * liquidar, para que los tests de reporte/liquidación tengan datos
 * garantizados sin depender de que alguien marque un turno real a mano en
 * la agenda. Se crea vía API directa (con el token de la sesión admin ya
 * logueada) en vez de por UI para no gastar tiempo/requests de más.
 *
 * Para turnos priceType=professor, el backend auto-completa BOOKED→COMPLETED
 * en un solo PATCH a "playing" (bookings.service.ts:402-434), así que no
 * hace falta el paso intermedio PLAYING→COMPLETED.
 *
 * Reintenta con distintas combinaciones de cancha/hora porque el slot
 * podría estar ocupado por una corrida anterior de este mismo helper
 * (los turnos COMPLETED siguen bloqueando el slot, ver bookings.service.ts:223).
 *
 * También deja un consumo interno pendiente de pago para ese mismo profesor,
 * así la tabla "Consumos Internos" y el botón de toggle siempre tienen algo
 * que mostrar (sin esto, TS-03b se skipearía siempre por falta de datos).
 */
async function createDisposableCompletedBooking(
  page: Page,
): Promise<{ teacherId: string; teacherName: string; bookingId: string }> {
  const token = await getAuthToken(page);
  const headers = { Authorization: `Bearer ${token}` };

  const teachersRes = await page.request.get(`${API_URL}/teachers`, { headers });
  const teachers = await teachersRes.json();
  test.skip(!teachers?.length, 'No hay profesores activos para crear el turno descartable');
  const teacher = teachers[0];

  const courtsRes = await page.request.get(`${API_URL}/courts`, { headers });
  const courts = await courtsRes.json();
  test.skip(!courts?.length, 'No hay canchas activas para crear el turno descartable');

  // El rango horario del club es configurable (GET /config: hora_apertura /
  // hora_cierre) y puede cruzar medianoche — generar candidatos fijos como
  // "06:00" puede caer fuera de ese rango y siempre devolver 400
  // ("excede el horario de cierre", bookings.service.ts:52-78).
  const configRes = await page.request.get(`${API_URL}/config`, { headers });
  const configList = await configRes.json();
  const configArr = Array.isArray(configList) ? configList : (configList?.data ?? []);
  const cfgMap = Object.fromEntries(configArr.map((c: any) => [c.key, c.value]));

  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const toHHMM = (min: number) => {
    const normalized = ((min % 1440) + 1440) % 1440;
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const openMin = toMin(cfgMap['hora_apertura'] ?? '09:00');
  let closeMin = toMin(cfgMap['hora_cierre'] ?? '23:00');
  if (closeMin <= openMin) closeMin += 1440; // cruce de medianoche

  const candidateHours: string[] = [];
  for (let t = openMin; t + 60 <= closeMin; t += 60) {
    candidateHours.push(toHHMM(t));
  }
  test.skip(!candidateHours.length, 'No hay ventana horaria válida para crear el turno descartable');

  const today = new Date().toISOString().slice(0, 10);
  const attemptErrors: string[] = [];

  for (const court of courts) {
    for (const hour of candidateHours) {
      const createRes = await page.request.post(`${API_URL}/bookings`, {
        headers,
        data: {
          courtId: court.id,
          date: today,
          hour,
          durationMinutes: 60,
          priceType: 'professor',
          teacherId: teacher.id,
          clientName: teacher.fullName,
        },
      });

      if (!createRes.ok()) {
        // Probar la próxima combinación cancha/hora (slot ocupado, cancha
        // inactiva, etc.) en vez de fallar en el primer intento.
        const body = await createRes.text().catch(() => '');
        attemptErrors.push(`${court.name ?? court.id} ${hour}: ${createRes.status()} ${body}`);
        continue;
      }

      const booking = await createRes.json();

      const playRes = await page.request.patch(`${API_URL}/bookings/${booking.id}`, {
        headers,
        data: { status: 'playing' },
      });
      expect(playRes.ok()).toBeTruthy();

      const fixtureProductRes = await page.request.post(`${API_URL}/products`, {
        headers,
        data: {
          name: `Consumo Profesor E2E ${Date.now()}`,
          costPrice: 100,
          salePrice: 1000,
          stock: 20,
          minStock: 1,
          icon: 'inventory_2',
        },
      });
      let product = fixtureProductRes.ok() ? await fixtureProductRes.json() : null;

      if (!product) {
        const productsRes = await page.request.get(`${API_URL}/products`, { headers });
        const products = await productsRes.json();
        const productList = Array.isArray(products) ? products : products?.data;
        product = productList?.find((p: any) => p.stock > 0) ?? null;
      }

      if (product) {
        await page.request.post(`${API_URL}/internal-consumption`, {
          headers,
          data: {
            productId: product.id,
            quantity: 1,
            consumerType: 'teacher',
            teacherId: teacher.id,
            date: today,
          },
        });
      }

      return { teacherId: teacher.id, teacherName: teacher.fullName, bookingId: booking.id };
    }
  }

  test.skip(
    true,
    `No se pudo crear el turno descartable en ninguna combinación cancha/hora:\n${attemptErrors.join('\n')}`,
  );
  throw new Error('unreachable');
}

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
 * Selecciona un profesor por nombre exacto en el combo y genera el reporte.
 * Se usa junto con `createDisposableCompletedBooking`, que ya garantiza que
 * ese profesor tiene un turno completado en el período por defecto — así no
 * hace falta barrer el combo entero probando profesor por profesor.
 */
async function generateReportForTeacherName(page: Page, teacherName: string): Promise<void> {
  const teacherSelect = page.locator('select').first();
  await teacherSelect.selectOption({ label: teacherName });

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

  test('TS-RBAC-01: un empleado SÍ puede acceder a /app/teachers/report y generar el reporte', async ({
    page,
  }) => {
    test.slow();
    await loginAsEmployee(page);

    // El empleado puede crear/completar turnos (bookings.controller.ts:166:
    // "Acceso: Admin y Empleado"), así que puede generar su propio turno
    // descartable con el mismo token que ya tiene en localStorage.
    const { teacherName } = await createDisposableCompletedBooking(page);

    await goToTeacherReport(page);

    // AdminGuard es un guard genérico de RBAC: data.roles incluye 'employee'
    // para esta ruta, así que no debe redirigir.
    await expect(page).toHaveURL(/\/app\/teachers\/report/);
    await expect(
      page.getByRole('heading', { name: 'Liquidación de Profesores' }),
    ).toBeVisible();

    await generateReportForTeacherName(page, teacherName);

    await expect(page.locator('#print-area')).toBeVisible();
    await expect(page.getByText('Total a Cobrar')).toBeVisible();
  });
});

test.describe('Liquidación de Profesores — Rol Admin', () => {
  let currentTeacherName: string;

  test.beforeEach(async ({ page }) => {
    // Navegar primero: localStorage no es accesible en about:blank
    // (SecurityError), hace falta estar en el origin de la app.
    await goToTeacherReport(page);
    ({ teacherName: currentTeacherName } = await createDisposableCompletedBooking(page));
  });

  test('TS-01: carga la pantalla de liquidación de profesores', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Liquidación de Profesores' }),
    ).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('TS-02: genera el reporte y muestra el resumen del período', async ({ page }) => {
    await generateReportForTeacherName(page, currentTeacherName);

    await expect(page.locator('#print-area')).toBeVisible();
    await expect(page.getByText('Total a liquidar')).toBeVisible();
    await expect(page.getByText('Total a Cobrar')).toBeVisible();
  });

  test('TS-03: la tabla "Consumos Internos" lista los consumos pendientes con sus columnas', async ({
    page,
  }) => {
    await generateReportForTeacherName(page, currentTeacherName);

    const printArea = page.locator('#print-area');
    await expect(printArea).toBeVisible();

    // El turno descartable siempre viene con un consumo interno pendiente
    // (ver createDisposableCompletedBooking), así que la tabla está garantizada.
    await expect(page.getByText('Consumos Internos', { exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Producto' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Cantidad' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Precio Unitario' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Subtotal' })).toBeVisible();
    await expect(page.getByText(/TOTAL CONSUMOS/)).toBeVisible();

    await expect(page.getByText('Total a Cobrar')).toBeVisible();
  });

  test('TS-03b: el botón "Ocultar/Ver consumos internos" alterna la tabla y recalcula el total', async ({
    page,
  }) => {
    await generateReportForTeacherName(page, currentTeacherName);
    await expect(page.locator('#print-area')).toBeVisible();

    // El turno descartable siempre viene con un consumo interno pendiente
    // (ver createDisposableCompletedBooking), así que el botón está garantizado.
    const toggleButton = page.getByRole('button', { name: /consumos internos/i });

    // Estado inicial: visible, botón dice "Ocultar".
    await expect(toggleButton).toHaveText('Ocultar consumos internos');
    await expect(page.getByRole('columnheader', { name: 'Producto' })).toBeVisible();

    const totalRow = page.locator('div', { hasText: 'Total a Cobrar' }).last();
    const totalWithConsumptions = await totalRow.locator('span.text-2xl').textContent();

    await toggleButton.click();

    // Tabla oculta, botón cambia a "Ver", y aparece la aclaración.
    await expect(toggleButton).toHaveText('Ver consumos internos');
    await expect(page.getByRole('columnheader', { name: 'Producto' })).not.toBeVisible();
    await expect(page.getByText('(sin consumos internos)')).toBeVisible();

    const totalWithoutConsumptions = await totalRow.locator('span.text-2xl').textContent();
    expect(totalWithoutConsumptions).not.toBe(totalWithConsumptions);

    await toggleButton.click();
    await expect(toggleButton).toHaveText('Ocultar consumos internos');
    await expect(page.getByText('(sin consumos internos)')).not.toBeVisible();
  });

  test('TS-04: el modal "Liquidar Deuda Completa" muestra los consumos de cantina y los totales', async ({
    page,
  }) => {
    await generateReportForTeacherName(page, currentTeacherName);
    await expect(page.locator('#print-area')).toBeVisible();

    await page.getByRole('button', { name: 'Liquidar Deuda Completa' }).click();

    // Escopeado a .modal-card: "Total a cobrar" también aparece en la pantalla
    // de fondo (label "Total a Cobrar" del reporte), que Playwright matchea
    // sin distinguir mayúsculas y produciría un strict-mode violation.
    const modal = page.locator('.modal-card');
    await expect(page.getByRole('heading', { name: 'Liquidar Deuda Completa' })).toBeVisible();
    await expect(modal.getByText('Consumos de Cantina')).toBeVisible();
    await expect(modal.getByText('Total a cobrar')).toBeVisible();
    await expect(modal.locator('input[type="radio"][value="cash"]')).toBeVisible();
    await expect(modal.locator('input[type="radio"][value="transfer"]')).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('TS-05: confirmar la liquidación envía la petición y resuelve con éxito o "Caja Cerrada"', async ({
    page,
  }) => {
    await generateReportForTeacherName(page, currentTeacherName);
    await expect(page.locator('#print-area')).toBeVisible();

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
    await generateReportForTeacherName(page, currentTeacherName);
    await expect(page.locator('#print-area')).toBeVisible();

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
