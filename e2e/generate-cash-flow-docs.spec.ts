/**
 * generate-cash-flow-docs.spec.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Script de documentación visual — Ciclo completo del módulo Cierre de Caja.
 *
 * Simula el ciclo de vida del dinero desde la apertura hasta el cierre diario:
 * 01 · Login admin
 * 02 · Apertura de caja (modal con fondo inicial)
 * 03 · Caja abierta — vista de Mi Turno
 * 04 · POS — ticket listo para cobrar
 * 05 · POS — paso de método de pago (efectivo)
 * 06 · POS — venta confirmada / comprobante
 * 07 · Caja — totales actualizados después de la venta
 * 08 · Caja — modal de arqueo / cierre de turno
 * 09 · Caja — turno cerrado + pendientes transferidos
 * 10 · Caja — modal de apertura de nuevo turno
 *
 * Ejecución:
 * npx playwright test e2e/generate-cash-flow-docs.spec.ts --project="Desktop Full HD"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.use({
  viewport: { width: 1280, height: 720 },
  video: 'on',
  storageState: { cookies: [], origins: [] },
});

const SCREENSHOTS_DIR = path.resolve(
  __dirname,
  '..',
  'docs',
  'screenshots-cash',
);

function ensureDir() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function ss(name: string) {
  return path.join(SCREENSHOTS_DIR, name);
}

async function dismissSweetAlertIfVisible(page: Page) {
  const popup = page.locator('.swal2-popup');
  await popup.waitFor({ state: 'visible', timeout: 1000 }).catch(() => null);
  if (await popup.isVisible().catch(() => false)) {
    await popup.getByRole('button', { name: /Entendido|Aceptar|OK/i }).click();
    await popup.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => null);
    await page.waitForTimeout(400);
  }
}

async function hasPendingBusinessDayAlert(page: Page) {
  const popup = page.locator('.swal2-popup');
  await popup.waitFor({ state: 'visible', timeout: 1000 }).catch(() => null);
  return popup.getByRole('heading', { name: /Jornada anterior pendiente/i }).isVisible().catch(() => false);
}

/** Rellena un input numérico por id con el valor dado. */
async function fillNumeric(
  page: Page,
  id: string,
  value: string,
) {
  await dismissSweetAlertIfVisible(page);
  const input = page.locator(`#${id}`);
  if (await input.isVisible().catch(() => false)) {
    await input.click({ clickCount: 3 });
    await input.fill(value);
  }
}

/**
 * Resalta un elemento con un recuadro rojo para la captura de pantalla sin romper el layout.
 * @param locator El elemento a resaltar
 * @param page La instancia de la página
 * @param screenshotPath La ruta donde se guardará la captura
 * @param isFullPage Si la captura debe ser de página completa
 */
async function screenshotWithHighlight(
  locator: import('@playwright/test').Locator,
  page: import('@playwright/test').Page,
  screenshotPath: string,
  isFullPage: boolean = false,
) {
  if (await locator.isVisible().catch(() => false)) {
    await locator.scrollIntoViewIfNeeded();

    const originalStyle = await locator.evaluate(
      (el: HTMLElement) => el.getAttribute('style') || '',
    );

    await locator.evaluate((el: HTMLElement) => {
      el.style.outline = '4px solid #ef4444';
      el.style.outlineOffset = '2px';
      el.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.8)';
      el.style.transition = 'none';
    });

    await page.waitForTimeout(400);
    await page.screenshot({ path: screenshotPath, fullPage: isFullPage });

    await locator.evaluate((el: HTMLElement, original: string) => {
      el.setAttribute('style', original);
    }, originalStyle);
  } else {
    await page.screenshot({ path: screenshotPath, fullPage: isFullPage });
  }
}

test('Documentar ciclo completo de Cierre de Caja', async ({ page }) => {
  test.setTimeout(180_000);
  ensureDir();

  await page.goto('/auth/login');
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');

  const userField = page.getByRole('textbox', { name: 'Usuario' });
  await userField.click();
  await userField.pressSequentially('admin', { delay: 50 });

  const passField = page.getByRole('textbox', { name: 'Contraseña' });
  await passField.click();
  await passField.pressSequentially('admin123', { delay: 50 });

  await page.waitForTimeout(800);

  const [loginResponse] = await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes('/auth/login') &&
        resp.request().method() === 'POST',
      { timeout: 20_000 },
    ),
    page.getByRole('button', { name: 'Iniciar Sesión' }).click(),
  ]);

  if (!loginResponse.ok()) {
    throw new Error(
      `Login falló con HTTP ${loginResponse.status()}. ` +
        `Verificá que el backend esté corriendo y que las credenciales admin/admin123 sean correctas.`,
    );
  }

  await page.waitForURL('**/app/**', { timeout: 10_000 });
  await page.waitForTimeout(800);

  await page.goto('/app/cash-register', {
    waitUntil: 'domcontentloaded',
    timeout: 15_000,
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);

  const abrirTurnoBtn = page
    .getByRole('button', { name: /Abrir Turno/i })
    .first();

  const cajaYaAbierta = !(await abrirTurnoBtn.isVisible().catch(() => false));

  if (!cajaYaAbierta) {
    await fillNumeric(page, 'fondo-inicial', '10000');
    await page.waitForTimeout(400);

    await screenshotWithHighlight(
      abrirTurnoBtn,
      page,
      ss('02-apertura-modal.png'),
      false,
    );

    await abrirTurnoBtn.click();
    await page.waitForTimeout(1500);
  } else {
    await page.screenshot({
      path: ss('02-caja-ya-abierta.png'),
      fullPage: true,
    });
  }

  const miTurnoBtn = page.getByRole('button', { name: /Mi Turno/i });
  if (await miTurnoBtn.isVisible().catch(() => false)) {
    await miTurnoBtn.click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: ss('03-caja-mi-turno.png'), fullPage: true });

  await page.goto('/app/pos');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const productos = page.getByRole('button').filter({ hasText: /\$\d/ });
  const totalProductos = await productos.count();

  if (totalProductos >= 1) {
    await productos.first().click();
    await page.waitForTimeout(400);
  }
  if (totalProductos >= 2) {
    await productos.nth(1).click();
    await page.waitForTimeout(400);
  } else if (totalProductos >= 1) {
    const plusBtn = page
      .getByRole('button', { name: 'Incrementar cantidad' })
      .first();
    if (await plusBtn.isVisible().catch(() => false)) {
      await plusBtn.click();
      await page.waitForTimeout(300);
    }
  }

  await page.waitForTimeout(600);

  const continuarBtn = page.getByRole('button', { name: /Continuar al Pago|Ir al Pago/i });
  await screenshotWithHighlight(
    continuarBtn,
    page,
    ss('04-pos-ticket.png'),
    true,
  );

  if (await continuarBtn.isVisible().catch(() => false)) {
    await continuarBtn.click();
    await page.waitForTimeout(800);

    const efectivoInput = page.locator('#efectivo');
    if (await efectivoInput.isVisible().catch(() => false)) {
      await efectivoInput.click({ clickCount: 3 });
      await efectivoInput.fill('5000');
    }
    await page.waitForTimeout(600);

    const confirmarBtn = page
      .getByRole('button', { name: /Confirmar Venta|Cobrar|Caja Cerrada/i })
      .first();
    await screenshotWithHighlight(
      confirmarBtn,
      page,
      ss('05-pos-metodo-pago.png'),
      true,
    );

    if (await confirmarBtn.isVisible().catch(() => false)) {
      const [ventaResp] = await Promise.all([
        page
          .waitForResponse(
            (resp) =>
              (resp.url().includes('/sales') || resp.url().includes('/pos')) &&
              resp.request().method() === 'POST',
            { timeout: 15_000 },
          )
          .catch(() => null),
        confirmarBtn.click(),
      ]);

      await page.waitForTimeout(1500);
      await page.screenshot({
        path: ss('06-pos-venta-confirmada.png'),
        fullPage: true,
      });
    }
  }

  await page.goto('/app/cash-register', {
    waitUntil: 'domcontentloaded',
    timeout: 15_000,
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);

  const miTurnoBtnPost = page.getByRole('button', { name: /Mi Turno/i });
  if (await miTurnoBtnPost.isVisible().catch(() => false)) {
    await miTurnoBtnPost.click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: ss('07-caja-totales.png'), fullPage: true });

  const cierreTurnoBtn = page
    .getByRole('button', { name: /Cierre de Turno/i })
    .first();
  if (await cierreTurnoBtn.isVisible().catch(() => false)) {
    await cierreTurnoBtn.click();
    await page.waitForTimeout(800);
  }

  await fillNumeric(page, 'efectivo-real', '15000');
  await screenshotWithHighlight(
    page.getByRole('button', { name: /Cerrar mi Turno/i }),
    page,
    ss('08-arqueo-comun.png'),
    false,
  );

  const cerrarMiTurnoBtn = page.getByRole('button', { name: /Cerrar mi Turno/i });
  if (await cerrarMiTurnoBtn.isVisible().catch(() => false)) {
    await cerrarMiTurnoBtn.click();
    await page.waitForTimeout(800);
  }

  const btnConfirmarNormal = page.getByRole('button', {
    name: /Confirmar cierre de turno/i,
  });
  await screenshotWithHighlight(
    btnConfirmarNormal,
    page,
    ss('08c-confirmacion-comun.png'),
    false,
  );
  if (await btnConfirmarNormal.isVisible().catch(() => false)) {
    await btnConfirmarNormal.click();
    await page.waitForTimeout(1500);
  }

  const nuevoTurnoBtn = page
    .getByRole('button', { name: /Abrir Nuevo Turno|Iniciar Nueva Jornada/i })
    .first();
  if (await nuevoTurnoBtn.isVisible().catch(() => false)) {
    await nuevoTurnoBtn.click();
    if (await hasPendingBusinessDayAlert(page)) {
      await page.screenshot({
        path: ss('09-jornada-anterior-pendiente.png'),
        fullPage: false,
      });
      await dismissSweetAlertIfVisible(page);
    } else {
      await fillNumeric(page, 'fondo-nuevo-turno', '10000');
      await page
        .getByRole('button', { name: /Abrir Turno|Iniciar Nueva Jornada/i })
        .last()
        .click();
      await page.waitForTimeout(1500);
    }
  }

  await page.goto('/app/schedule');
  await page.waitForTimeout(1000);
  const pendingSlot = page
    .getByRole('button', { name: /Disponible 12:00/ })
    .first();
  if (await pendingSlot.isVisible().catch(() => false)) {
    await pendingSlot.click({ timeout: 3_000 }).catch(() => null);
    await page.waitForTimeout(800);
    const bookingName = page
      .getByRole('textbox', { name: /Cliente|Jugador|Nombre/i })
      .first();
    if (await bookingName.waitFor({ state: 'visible', timeout: 1_500 }).then(() => true).catch(() => false)) {
      await bookingName.fill('Jugador en Cancha');
    }
  }

  const btnGuardarReserva = page.getByRole('button', {
    name: /Guardar Reserva/i,
  });
  if (await btnGuardarReserva.waitFor({ state: 'visible', timeout: 1_500 }).then(() => true).catch(() => false)) {
    await screenshotWithHighlight(
      btnGuardarReserva,
      page,
      ss('10-creando-pendiente.png'),
      false,
    );
  } else {
    await page.screenshot({ path: ss('10-creando-pendiente.png'), fullPage: false });
  }
  if (await btnGuardarReserva.isEnabled({ timeout: 1_500 }).catch(() => false)) {
    await btnGuardarReserva.click();
    await page.waitForTimeout(1500);
  }

  await page.goto('/app/cash-register', {
    waitUntil: 'domcontentloaded',
    timeout: 15_000,
  });
  await page.waitForTimeout(1000);
  const closeTurnTab = page
    .getByRole('button', { name: /Cierre de Turno/i })
    .first();
  if (await closeTurnTab.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false)) {
    await closeTurnTab.click();
    await page.waitForTimeout(1000);
  }

  const btnTraspasar = page.getByRole('button', {
    name: /Traspasar y cerrar turno/i,
  });
  await screenshotWithHighlight(
    btnTraspasar,
    page,
    ss('11-modal-traspaso-pendientes.png'),
    false,
  );

  if (await btnTraspasar.isVisible().catch(() => false)) {
    await btnTraspasar.click();
    await page.waitForTimeout(2000);
  }

  await page.screenshot({
    path: ss('12-caja-final-cerrada.png'),
    fullPage: true,
  });
});
