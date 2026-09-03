/**
 * Suite E2E — Caja y Jornada Comercial: Edge Cases
 * =====================================================
 * Escenarios:
 *  E2E-CJ-01  Happy Path Multi-Empleado
 *  E2E-CJ-02  El Cerrojo 409 — Día Olvidado
 *  E2E-CJ-03  Recuperación de múltiples días acumulados
 *  E2E-CJ-04  Viaje en el Tiempo — Problema de la Medianoche
 *
 * AISLAMIENTO: Todos los tests bloquean /api/v1/cash/* con una ruta catch-all
 * registrada primero (LIFO → revisada última), garantizando que ningún test
 * toca la base de datos real aunque falte un mock específico.
 */

import { test, expect, Page, Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Payloads mock (forma exacta de CashApiResponse que espera el servicio)
// ---------------------------------------------------------------------------

const noSessionPayload = () => ({
  session: null,
  cashIncome: 0,
  cashExpenseTotal: 0,
  cashExpected: 0,
  transferTotal: 0,
  dayTotal: 0,
  initialBalance: 0,
  transactions: [],
  isOpen: false,
  staleSession: false,
  isBusinessDayClosed: false,
});

/** Turno ABIERTO por Empleado 1. */
const openSessionPayload = (sessionId = 'sess-001') => ({
  session: {
    id: sessionId,
    status: 'OPEN',
    date: '2026-04-09',
    openedAt: '2026-04-09T10:00:00.000Z',
    initialBalance: 500,
    cashCounted: null,
    difference: null,
    notes: null,
    openedByUser: { fullName: 'Empleado Uno', username: 'empleado1' },
  },
  cashIncome: 1500,
  cashExpenseTotal: 0,
  cashExpected: 1500,
  transferTotal: 300,
  dayTotal: 1800,
  initialBalance: 500,
  transactions: [],
  isOpen: true,
  staleSession: false,
  isBusinessDayClosed: false,
});

/**
 * Turno CERRADO — jornada sigue activa.
 * isOpen = false  →  isClosed = true en el componente.
 * isBusinessDayClosed = false  →  muestra "Cerrar Jornada (Z)".
 */
const closedSessionPayload = (sessionId = 'sess-001') => ({
  session: {
    id: sessionId,
    status: 'CLOSED',
    date: '2026-04-09',
    openedAt: '2026-04-09T10:00:00.000Z',
    initialBalance: 500,
    cashCounted: 2000,
    difference: 500,
    notes: null,
    openedByUser: { fullName: 'Empleado Uno', username: 'empleado1' },
  },
  cashIncome: 1500,
  cashExpenseTotal: 0,
  cashExpected: 1500,
  transferTotal: 300,
  dayTotal: 1800,
  initialBalance: 500,
  transactions: [],
  isOpen: false,
  staleSession: false,
  isBusinessDayClosed: false,
});

/**
 * Sesión huérfana del 07/04 todavía sin cierre de jornada.
 * Se devuelve tras cerrar el día 08/04, para simular que aún queda otro día.
 */
const anotherOrphanPayload = () => ({
  session: {
    id: 'sess-07apr',
    status: 'CLOSED',
    date: '2026-04-07',
    openedAt: '2026-04-07T09:00:00.000Z',
    initialBalance: 0,
    cashCounted: 1000,
    difference: 0,
    notes: null,
    openedByUser: { fullName: 'Empleado Dos', username: 'empleado2' },
  },
  cashIncome: 1000,
  cashExpenseTotal: 0,
  cashExpected: 1000,
  transferTotal: 0,
  dayTotal: 1000,
  initialBalance: 0,
  transactions: [],
  isOpen: false,
  staleSession: true,
  isBusinessDayClosed: false,   // ← sigue sin cierre formal
});

const dailyClosureSuccessPayload = () => ({
  date: '2026-04-08',
  totalExpected: 1800,
  totalCounted: 2000,
  sessions: [
    {
      sessionId: 'sess-001',
      openedByName: 'Empleado Uno',
      openedAt: '2026-04-08T09:00:00.000Z',
      closedAt: '2026-04-08T18:00:00.000Z',
      status: 'closed',
      cashExpected: 1500,
      transferTotal: 300,
      dayTotal: 1800,
      cashCounted: 2000,
      difference: 500,
    },
  ],
});

// ---------------------------------------------------------------------------
// Helpers de ruta
// ---------------------------------------------------------------------------

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/**
 * Bloquea con abort() TODA petición a /api/v1/cash/* que no sea
 * interceptada por un mock más específico registrado después.
 *
 * Playwright usa LIFO: el último `page.route()` registrado se ejecuta
 * primero. Al registrar este catch-all PRIMERO, queda con la menor
 * prioridad y solo atrapa lo que los mocks específicos no capturaron.
 */
async function blockUnmockedCashRequests(page: Page) {
  await page.route('**/api/v1/cash/**', (route: Route) => {
    console.warn(`[CATCH-ALL] Request not mocked: ${route.request().url()}`);
    route.abort('blockedbyclient');
  });
}

/**
 * Mocks auxiliares (suggestion + check-pendings) que casi todos los
 * tests necesitan. Registrar después del catch-all.
 */
async function mockAuxEndpoints(page: Page) {
  await page.route('**/api/v1/cash/sessions/suggestion', (route) =>
    route.fulfill(json({ cashCounted: null })),
  );
  await page.route('**/api/v1/cash/check-pendings', (route) =>
    route.fulfill(json({ pendingBookings: 0, unpaidSales: 0 })),
  );
}

/**
 * Configura GET /cash/current para recorrer `sequence` en orden.
 * Cada llamada HTTP consume el siguiente elemento; la última respuesta
 * se repite indefinidamente.
 *
 * NOTA: layout.component también llama getCurrent(). Con el caché de 10 s
 * del servicio sólo se emite un único HTTP request por ciclo de navegación,
 * así que cada carga de página cuenta como UNA llamada en la secuencia.
 */
async function mockCurrentSequence(page: Page, sequence: object[]) {
  let idx = 0;
  await page.route('**/api/v1/cash/current', (route: Route) => {
    const payload = sequence[Math.min(idx, sequence.length - 1)];
    idx++;
    route.fulfill(json(payload));
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Caja y Jornada Comercial — Edge Cases', () => {

  // =========================================================================
  // E2E-CJ-01: Happy Path Multi-Empleado
  // =========================================================================
  test.describe('E2E-CJ-01: Happy Path Multi-Empleado', () => {
    /**
     * Flujo:
     *  1. Sin sesión → pantalla "Caja Cerrada"
     *  2. Empleado 1 abre turno → dashboard activo
     *  3. Empleado 1 cierra turno vía modal de confirmación
     *  4. La UI muestra "El turno fue cerrado correctamente" con los botones
     *     "Abrir Nuevo Turno" y "Cerrar Jornada (Z)" visibles y habilitados
     */
    test('muestra estado jornada activa sin turno abierto y ambos botones disponibles', async ({ page }) => {
      // ── Registro de mocks en orden (LIFO → registrado-último = prioridad-mayor)
      // 1. catch-all (prioridad mínima — registrado primero)
      await blockUnmockedCashRequests(page);
      // 2. auxiliares
      await mockAuxEndpoints(page);
      // 3. secuencia de /current:  carga → post-apertura → post-cierre
      await mockCurrentSequence(page, [
        noSessionPayload(),       // carga inicial + layout
        openSessionPayload(),     // tras abrir turno
        closedSessionPayload(),   // tras cerrar turno
      ]);
      // 4. POST /sessions → 201
      await page.route('**/api/v1/cash/sessions', (route) => {
        route.request().method() === 'POST'
          ? route.fulfill(json({ id: 'sess-001', date: '2026-04-09', status: 'OPEN' }, 201))
          : route.continue();
      });
      // 5. PATCH /sessions/current → 200
      await page.route('**/api/v1/cash/sessions/current', (route) => {
        route.request().method() === 'PATCH'
          ? route.fulfill(json({ id: 'sess-001', closedAt: '2026-04-09T18:00:00.000Z', diferencia: 500 }))
          : route.continue();
      });

      // ── Paso 1: estado inicial
      await page.goto('/app/cash-register');
      await expect(page.getByRole('button', { name: /Abrir Turno/i })).toBeVisible();

      // ── Paso 2: Empleado 1 abre turno
      await page.fill('#fondo-inicial', '500');
      // El botón dice "Abrir Turno" en mobile y "Abrir Turno de Caja" en ≥sm.
      // getByRole filtra por texto: usamos regex para capturar ambos.
      await page.getByRole('button', { name: /^Abrir Turno( de Caja)?$/ }).click();
      await page.waitForLoadState('networkidle');

      // ── Paso 3: dashboard activo → navegar a "Cierre de Turno"
      await expect(page.getByText('Efectivo Esperado')).toBeVisible();
      await page.getByRole('button', { name: 'Cierre de Turno' }).click();

      // ── Paso 4: rellenar efectivo contado (id="efectivo-real") y abrir dialog
      await expect(page.getByRole('heading', { name: 'Arqueo de Turno' })).toBeVisible();
      await page.fill('#efectivo-real', '2000');
      await page.getByRole('button', { name: 'Cerrar mi Turno' }).click();

      // ── Paso 5: confirmar en el modal de confirmación
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('heading', { name: /Confirmar Cierre/i })).toBeVisible();
      await dialog.getByRole('button', { name: 'Confirmar cierre de turno' }).click();
      await page.waitForLoadState('networkidle');

      // ── Paso 6: verificaciones de estado final
      // Mensaje de turno cerrado
      await expect(
        page.getByText('El turno fue cerrado correctamente'),
      ).toBeVisible({ timeout: 5000 });

      // Botón para el siguiente empleado
      await expect(
        page.getByRole('button', { name: 'Abrir Nuevo Turno' }),
      ).toBeVisible();

      // Botón para cerrar la jornada completa — visible Y habilitado
      const btnCerrarJornada = page.getByRole('button', { name: /Cerrar Jornada|Finalizar Jornada/i });
      await expect(btnCerrarJornada).toBeVisible();
      await expect(btnCerrarJornada).toBeEnabled();
    });
  });

  // =========================================================================
  // E2E-CJ-02: El Cerrojo 409 — Día Olvidado
  // =========================================================================
  test.describe('E2E-CJ-02: El Cerrojo 409 — Día Olvidado', () => {
    /**
     * Flujo:
     *  1. Sin sesión activa hoy (hay un día olvidado en el pasado)
     *  2. POST /sessions → 409 con "pendiente de cierre"
     *  3. El frontend muestra Swal "Jornada anterior pendiente"
     *  4. Tras cerrar el Swal, loadCurrentSession() actualiza la UI con la
     *     sesión huérfana cerrada
     *  5. ASERCIÓN CRÍTICA: "Cerrar Jornada (Z)" visible y habilitado
     */
    test('muestra alerta 409 y mantiene "Cerrar Jornada (Z)" accesible para destrabar', async ({ page }) => {
      await blockUnmockedCashRequests(page);
      await mockAuxEndpoints(page);
      await mockCurrentSequence(page, [
        noSessionPayload(),          // carga inicial
        closedSessionPayload('sess-orphan'), // tras el 409 + loadCurrentSession
      ]);
      // POST /sessions → 409 con mensaje que contiene "pendiente de cierre"
      await page.route('**/api/v1/cash/sessions', (route) => {
        if (route.request().method() === 'POST') {
          route.fulfill(json({
            statusCode: 409,
            message: 'La jornada del 07/04 está pendiente de cierre. Cerrala antes de abrir una nueva.',
            error: 'Conflict',
          }, 409));
        } else {
          route.continue();
        }
      });

      // ── Navegar
      await page.goto('/app/cash-register');
      await expect(page.getByRole('button', { name: /Abrir Turno/i })).toBeVisible();

      // ── Intentar abrir turno → dispara 409
      await page.getByRole('button', { name: /^Abrir Turno( de Caja)?$/ }).click();

      // ── Aserción 1: Swal visible con título correcto
      // SweetAlert2 usa role="dialog" y sus propios estilos.
      const swalPopup = page.locator('.swal2-popup');
      await expect(swalPopup).toBeVisible({ timeout: 6000 });
      await expect(swalPopup.getByText('Jornada anterior pendiente')).toBeVisible();

      // ── Aserción 2: el cuerpo del Swal menciona el botón que debe usar el operador
      await expect(swalPopup.getByText(/Finalizar Jornada/i)).toBeVisible();

      // ── Cerrar Swal
      await swalPopup.getByRole('button', { name: 'Entendido' }).click();

      // ── Esperar actualización de UI (loadCurrentSession se disparó)
      await page.reload();
      await page.waitForLoadState('networkidle');

      // ── ASERCIÓN CRÍTICA: "Cerrar Jornada (Z)" debe estar visible y habilitado
      // (el 409 impide abrir turno, por lo que el dashboard nunca se renderiza;
      //  el botón aparece directamente en la pantalla de "Caja Cerrada / Jornada Activa")
      const btnCerrarJornada = page.getByRole('button', { name: /Cerrar Jornada|Finalizar Jornada/i });
      await expect(btnCerrarJornada).toBeVisible({ timeout: 5000 });
      await expect(btnCerrarJornada).toBeEnabled();
    });
  });

  // =========================================================================
  // E2E-CJ-03: Recuperación de múltiples días acumulados
  // =========================================================================
  test.describe('E2E-CJ-03: Recuperación de múltiples días acumulados', () => {
    /**
     * Flujo:
     *  1. Estado inicial: sesión del 08/04 cerrada, sin cierre de jornada
     *  2. El operador presiona "Cerrar Jornada (Z)" → Swal de confirmación
     *  3. POST /daily-closures → 201 (cierra el día 08/04)
     *  4. Swal de éxito → OK
     *  5. loadCurrentSession() trae sesión del 07/04 también sin cerrar
     *  6. ASERCIÓN: "Cerrar Jornada (Z)" reaparece (backend cerró el más antiguo,
     *     pero queda otro pendiente)
     */
    test('"Cerrar Jornada (Z)" reaparece cuando quedan más días pendientes', async ({ page }) => {
      await blockUnmockedCashRequests(page);
      await mockAuxEndpoints(page);
      await mockCurrentSequence(page, [
        closedSessionPayload('sess-08apr'), // carga inicial: sesión del 08/04
        anotherOrphanPayload(),             // tras cerrar 08/04: queda el 07/04
      ]);
      // POST /daily-closures → 201 éxito
      await page.route('**/api/v1/cash/daily-closures', (route) => {
        if (route.request().method() === 'POST') {
          route.fulfill(json(dailyClosureSuccessPayload(), 201));
        } else {
          route.continue();
        }
      });

      // ── Navegar — carga el estado del 08/04 (turno cerrado, jornada activa)
      await page.goto('/app/cash-register');

      // Necesitamos estar en la sub-pestaña "Cierre de Turno" para ver el botón
      // (el botón "Cerrar Jornada (Z)" aparece dentro del panel #cajaCerrada)
      await page.getByRole('button', { name: 'Cierre de Turno' }).click();

      const btnCerrarJornada = page.getByRole('button', { name: /Cerrar Jornada|Finalizar Jornada/i });
      await expect(btnCerrarJornada).toBeVisible({ timeout: 5000 });
      await expect(btnCerrarJornada).toBeEnabled();

      // ── Presionar "Cerrar Jornada (Z)" → Swal de confirmación interna
      await btnCerrarJornada.click();

      const swalConfirm = page.locator('.swal2-popup');
      await expect(swalConfirm).toBeVisible({ timeout: 5000 });
      await expect(swalConfirm.getByText('¿Cerrar Jornada Completa?')).toBeVisible();

      // Confirmar
      await swalConfirm.getByRole('button', { name: 'Sí, cerrar jornada' }).click();

      // ── Swal de éxito
      const swalSuccess = page.locator('.swal2-popup');
      await expect(swalSuccess.getByText('Jornada cerrada')).toBeVisible({ timeout: 5000 });
      // Cerrar el Swal de éxito (el botón OK/Aceptar de SweetAlert2)
      await swalSuccess.getByRole('button').first().click();

      // ── loadCurrentSession() devuelve el 07/04 (anotherOrphanPayload)
      await page.waitForLoadState('networkidle');

      // ── ASERCIÓN: el botón vuelve a aparecer para el día restante
      const btnCerrarJornada2 = page.getByRole('button', { name: /Cerrar Jornada|Finalizar Jornada/i });
      await expect(btnCerrarJornada2).toBeVisible({ timeout: 5000 });
      await expect(btnCerrarJornada2).toBeEnabled();
    });
  });

  // =========================================================================
  // E2E-CJ-05: DAY_ALREADY_CLOSED — Flujo "Reabrir Hoy"
  // =========================================================================
  test.describe('E2E-CJ-05: DAY_ALREADY_CLOSED — Flujo Reabrir Hoy', () => {
    /**
     * Flujo:
     *  1. Sin sesión activa — la jornada de hoy ya fue cerrada formalmente.
     *  2. El operador ingresa el fondo e intenta abrir → POST /sessions → 409 DAY_ALREADY_CLOSED.
     *  3. El frontend muestra el Swal de conflicto con título "Advertencia"
     *     y los botones "Reabrir" y "mañana".
     *  4. El operador hace clic en "Reabrir jornada de hoy".
     *  5. El frontend reenvía POST /sessions con conflictAction: 'reopen_today' → 201.
     *  6. La UI muestra el toast de éxito "Jornada reabierta".
     */
    test('reenvía conflictAction reopen_today y muestra éxito al confirmar "Reabrir hoy"', async ({ page }) => {
      // ── Mocks (LIFO: catch-all registrado primero = prioridad mínima)
      await blockUnmockedCashRequests(page);
      await mockAuxEndpoints(page);
      // /current: carga inicial → post-apertura exitosa
      await mockCurrentSequence(page, [
        noSessionPayload(),
        openSessionPayload('sess-CJ05'),
      ]);

      // POST /sessions: primera llamada → 409, segunda → 201
      // Capturamos ambos payloads para verificar que el segundo incluya conflictAction.
      let openCallCount = 0;
      const capturedPayloads: Record<string, unknown>[] = [];

      await page.route('**/api/v1/cash/sessions', (route) => {
        if (route.request().method() !== 'POST') {
          route.continue();
          return;
        }
        openCallCount++;
        capturedPayloads.push(
          route.request().postDataJSON() as Record<string, unknown>,
        );

        if (openCallCount === 1) {
          // Primera llamada: jornada ya cerrada
          route.fulfill(
            json(
              {
                errorCode: 'DAY_ALREADY_CLOSED',
                message:
                  'La jornada de hoy ya fue cerrada. Indicá cómo querés proceder.',
                date: '2026-06-16',
              },
              409,
            ),
          );
        } else {
          // Segunda llamada: éxito
          route.fulfill(
            json({ id: 'sess-CJ05', date: '2026-06-16', status: 'OPEN' }, 201),
          );
        }
      });

      // ── Navegar
      await page.goto('/app/cash-register');
      await expect(page.locator('#fondo-inicial')).toBeVisible({
        timeout: 10000,
      });

      // ── Paso 1: intentar abrir → dispara el 409
      await page.fill('#fondo-inicial', '5000');
      await page
        .getByRole('button', { name: /^Abrir Turno( de Caja)?$/ })
        .click();

      // ── Paso 2: Swal de conflicto visible con botones correctos
      const swalPopup = page.locator('.swal2-popup');
      await expect(swalPopup).toBeVisible({ timeout: 6000 });
      await expect(swalPopup.getByText('Advertencia')).toBeVisible();
      await expect(
        swalPopup.getByRole('button', { name: /Reabrir/i }),
      ).toBeVisible();
      await expect(
        swalPopup.getByRole('button', { name: /mañana/i }),
      ).toBeVisible();

      // ── Paso 3: confirmar "Reabrir jornada de hoy"
      await swalPopup.getByRole('button', { name: /Reabrir/i }).click();
      await page.waitForLoadState('networkidle');

      // ── Aserción A: se enviaron exactamente 2 peticiones POST
      expect(openCallCount).toBe(2);

      // ── Aserción B: segunda petición lleva conflictAction: 'reopen_today'
      expect(capturedPayloads[1]).toMatchObject({
        conflictAction: 'reopen_today',
      });
      expect(capturedPayloads[1].initialBalance).toBeGreaterThan(0);

      // ── Aserción C: toast de éxito visible en la UI
      await expect(page.getByText('Jornada reabierta')).toBeVisible({
        timeout: 5000,
      });
    });
  });

  // =========================================================================
  // E2E-CJ-04: Viaje en el Tiempo — Problema de la Medianoche
  // =========================================================================
  test.describe('E2E-CJ-04: Viaje en el Tiempo — Problema de la Medianoche', () => {
    /**
     * Se fija el reloj a las 02:00 AM del 10/04/2026.
     *
     * Regla de negocio: horas < 03:00 pertenecen al DÍA ANTERIOR.
     *   logicalCommercialDate getter → getHours() = 2 < 3 → resta 1 día → 2026-04-09
     *
     * Aserciones:
     *  A. El banner de apertura muestra "9 de abril" (no "10 de abril").
     *  B. La nota de madrugada "antes de las 03:00 corresponde al día anterior" es visible.
     *  C. El payload que el frontend envía al backend NO incluye un campo `date`
     *     con el valor incorrecto "2026-04-10" (la fecha la calcula el backend,
     *     el frontend solo manda initialBalance).
     */
    test('el banner muestra la fecha comercial correcta (día anterior) a las 02:00 AM', async ({ page }) => {
      // NOTA: setFixedTime se registra DESPUÉS de page.goto() para evitar que el
      // auth guard (isTokenExpired → Date.now()) vea el token como expirado y
      // redirija a login antes de que la página de caja cargue.

      await blockUnmockedCashRequests(page);
      await mockAuxEndpoints(page);

      // Secuencia /current:
      //  1ra llamada (layout + component, misma cache) → sin sesión → pantalla Apertura
      //  2da llamada (post-apertura) → turno abierto
      await mockCurrentSequence(page, [
        noSessionPayload(),
        openSessionPayload('sess-midnight'),
      ]);

      // Capturar el payload enviado al abrir turno
      let capturedPayload: Record<string, unknown> | null = null;
      await page.route('**/api/v1/cash/sessions', (route) => {
        if (route.request().method() === 'POST') {
          capturedPayload = route.request().postDataJSON() as Record<string, unknown>;
          route.fulfill(json({ id: 'sess-midnight', date: '2026-04-09', status: 'OPEN' }, 201));
        } else {
          route.continue();
        }
      });

      // ── Navegar con reloj REAL (auth guard usa Date.now() para verificar JWT)
      await page.goto('/app/cash-register');
      await expect(page.locator('#fondo-inicial')).toBeVisible({ timeout: 10000 });

      // ── Fijar reloj a 02:00 AM del 10/04 DESPUÉS de cargar la página
      // El guard ya pasó; ahora el componente evaluará logicalCommercialDate con este reloj.
      await page.clock.setFixedTime(new Date('2026-04-10T02:00:00'));

      // ── Disparar change detection de Angular.
      // OJO: un simple .click() acá NO alcanza. El componente usa OnPush, así que
      // sólo se re-chequea ante un evento efectivamente bindeado en su template;
      // #fondo-inicial no tiene (click). Escribir en el input sí dispara
      // ngModelChange, y eso marca el componente para chequeo, con lo que se
      // re-evalúa logicalCommercialDateLabel (getter impuro que lee new Date()).
      await page.fill('#fondo-inicial', '0');

      // ── ASERCIÓN A: el banner muestra la fecha comercial = 9 de abril (día anterior)
      // El template renderiza logicalCommercialDateLabel en español argentino.
      // Con el reloj fijado a 10/04 02:00, getHours()=2 < 3 → fecha = 09/04.
      await expect(
        page.getByText(/9 de abril/i),
      ).toBeVisible({ timeout: 3000 });

      // Sanity check: el día incorrecto (10 de abril) NO debe aparecer en el banner
      // (restringimos la búsqueda al bloque azul de información)
      const bannerBloque = page.locator('.bg-blue-50');
      await expect(bannerBloque.getByText(/10 de abril/i)).not.toBeVisible();

      // ── ASERCIÓN B: nota de madrugada visible
      await expect(
        page.getByText(/antes de las 03:00 corresponde al día anterior/i),
      ).toBeVisible();

      // ── Abrir turno para capturar el payload
      await page.fill('#fondo-inicial', '0');
      await page.getByRole('button', { name: /^Abrir Turno( de Caja)?$/ }).click();
      await page.waitForLoadState('networkidle');

      // ── ASERCIÓN C: el payload NO tiene campo `date` con valor erróneo
      // El DTO de apertura es { initialBalance, notes? } — sin fecha.
      // Si el componente enviara la fecha del cliente, rompería la regla de medianoche
      // porque `new Date()` daría "2026-04-10" en vez de la fecha comercial correcta.
      expect(capturedPayload).not.toBeNull();
      if (capturedPayload) {
        // El frontend NO debe mandar fecha (la calcula el backend)
        expect(Object.keys(capturedPayload)).not.toContain('date');
        // Pero sí debe mandar el fondo inicial
        expect(capturedPayload).toHaveProperty('initialBalance', 0);
      }
    });
  });
});
