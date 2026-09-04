/**
 * generate-docs.spec.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Script de documentación visual para el ERP "La Caldera".
 * Objetivo: recorrer todos los módulos y capturar pantallas de alta calidad
 * para armar el Manual de Usuario.  NO hace assertions estrictos — cualquier
 * estado de la app es válido siempre que sea visible y no crashee.
 *
 * Salida:
 *   docs/screenshots/  → imágenes PNG nombradas secuencialmente
 *   test-results/      → video .webm del recorrido completo (video: 'on')
 *
 * Ejecución:
 *   npx playwright test e2e/generate-docs.spec.ts --project="Desktop Full HD"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.use({
  viewport: { width: 1920, height: 1080 },
  video: 'on',
  storageState: { cookies: [], origins: [] },
});

const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');

function ensureDir() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function screenshotPath(name: string): string {
  return path.join(SCREENSHOTS_DIR, name);
}

async function closeBookingModalIfVisible(page: Page) {
  const modal = page.getByTestId('booking-modal');
  if (await modal.isVisible().catch(() => false)) {
    await modal.getByRole('button', { name: 'Cerrar' }).click();
    await page.waitForTimeout(400);
  }
}

test('Generar Documentación de Usuario', async ({ page }) => {
  test.setTimeout(120_000);
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
  await page.screenshot({
    path: screenshotPath('01-login.png'),
    fullPage: true,
  });

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
        `Verificá que el backend esté corriendo en http://localhost:3000 ` +
        `y que las credenciales admin/admin123 sean correctas.`,
    );
  }

  await page.waitForURL('**/app/**', { timeout: 10_000 });

  await page.waitForTimeout(1000);

  await page.goto('/app/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: screenshotPath('02-dashboard.png'),
    fullPage: true,
  });

  await page.goto('/app/schedule');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: screenshotPath('03-schedule-grilla.png'),
    fullPage: true,
  });

  const primerSlot = page
    .getByRole('button', { name: /Disponible \d{2}:\d{2}/ })
    .first();
  const haySlot = await primerSlot.isVisible().catch(() => false);
  if (haySlot) {
    await primerSlot.click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: screenshotPath('04-schedule-modal.png'),
      fullPage: false,
    });

    await closeBookingModalIfVisible(page);
  }

  await page.goto('/app/pos');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: screenshotPath('05-pos-vacio.png'),
    fullPage: true,
  });

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

  await page.waitForTimeout(800);
  await page.screenshot({
    path: screenshotPath('06-pos-carrito.png'),
    fullPage: true,
  });

  await page.goto('/app/cash-register');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: screenshotPath('07-cash-register.png'),
    fullPage: true,
  });

  await page.goto('/app/expenses');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  await page.screenshot({
    path: screenshotPath('08-expenses-lista.png'),
    fullPage: true,
  });

  const nuevoEgresoBtn = page.getByRole('button', { name: 'Nuevo Egreso' });
  if (await nuevoEgresoBtn.isVisible().catch(() => false)) {
    await nuevoEgresoBtn.click();
    await page.waitForTimeout(800);

    const amountInput = page.locator('#amount');
    if (await amountInput.isVisible().catch(() => false)) {
      await amountInput.fill('1500');
    }
    const descInput = page.locator('#description');
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.fill('Material de limpieza – Prueba Manual');
    }
    const categorySelect = page.locator('#category');
    if (await categorySelect.isVisible().catch(() => false)) {
      await categorySelect.selectOption({ index: 1 }).catch(() => {});
    }

    await page.waitForTimeout(600);
    await page.screenshot({
      path: screenshotPath('09-expenses-modal.png'),
      fullPage: false,
    });

    const cancelBtn = page.getByRole('button', { name: /Cancelar/i }).first();
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
      await page.waitForTimeout(400);
    }
  }

  await page.goto('/app/inventory/alerts');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: screenshotPath('10-inventory-alerts.png'),
    fullPage: true,
  });

  await page.goto('/app/teachers/report');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: screenshotPath('11-teachers-report.png'),
    fullPage: true,
  });

  await page.goto('/app/products');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: screenshotPath('12-products.png'),
    fullPage: true,
  });

  await page.goto('/app/reports');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: screenshotPath('13-reports.png'),
    fullPage: true,
  });

  await page.goto('/app/settings');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await page.screenshot({
    path: screenshotPath('14-settings.png'),
    fullPage: true,
  });

  await page.goto('/app/users');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await page.screenshot({
    path: screenshotPath('15-users.png'),
    fullPage: true,
  });
});
