/**
 * E2E — Agenda de Turnos en viewport móvil (390×844, iPhone 13)
 *
 * Ejecutar solo este archivo:
 *   npx playwright test e2e/schedule.mobile.spec.ts --project=mobile-chrome
 *
 * Ejecutar toda la suite móvil:
 *   npx playwright test --project=mobile-chrome
 */

import { test, expect } from '@playwright/test';

test.describe('Agenda — Mobile (390×844)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/schedule');
    await expect(page.getByRole('heading', { name: 'Agenda de Canchas' })).toBeVisible({
      timeout: 10_000,
    });
    // Navigate to a future date (+30 days) with no seed bookings so cdk-drag
    // booking cards don't intercept pointer events on available slots.
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const datePicker = page.locator('input[type="date"]').first();
    await datePicker.fill(futureDate);
    await datePicker.dispatchEvent('change');
    await page.waitForLoadState('networkidle');
  });

  // ── 1. Sin overflow horizontal en el body ─────────────────────────────────
  test('el body no desborda horizontalmente — el scroll es interno a la grilla', async ({
    page,
  }) => {
    const viewportWidth = page.viewportSize()!.width; // 390 px (iPhone 13)

    const bodyScrollWidth = await page.evaluate(
      () => document.body.scrollWidth,
    );

    // El body NO debe ser más ancho que el viewport.
    // Si bodyScrollWidth > viewportWidth, significa que algún elemento hijo
    // desborda fuera del contenedor overflow-x-auto y rompe el layout.
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth);
  });

  // ── 2. La grilla tiene scroll horizontal INTERNO ──────────────────────────
  test('el contenedor de la grilla tiene scroll horizontal interno', async ({
    page,
  }) => {
    // El div con overflow-x-auto debe tener un scrollWidth > clientWidth
    // cuando hay 2+ canchas en una pantalla de 390 px.
    const gridScrollable = await page.evaluate(() => {
      // Buscamos el primer elemento con overflow-x: auto que contenga la grilla
      const el = document.querySelector('.overflow-x-auto') as HTMLElement | null;
      if (!el) return null;
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowX: getComputedStyle(el).overflowX,
      };
    });

    expect(gridScrollable).not.toBeNull();
    expect(gridScrollable!.overflowX).toBe('auto');
    // Con 2+ canchas a 200 px mínimo + 80 px de horas = 480 px > 390 px viewport
    expect(gridScrollable!.scrollWidth).toBeGreaterThan(gridScrollable!.clientWidth);
  });

  // ── 3. La columna de horas queda sticky al hacer scroll lateral ───────────
  test('la etiqueta de hora permanece visible al hacer scroll lateral en la grilla', async ({
    page,
  }) => {
    const gridContainer = page.locator('.overflow-x-auto').first();
    await expect(gridContainer).toBeVisible();

    // Scroll hasta el extremo derecho (simula deslizar hasta la última cancha)
    await gridContainer.evaluate((el) => {
      el.scrollLeft = el.scrollWidth; // desplaza hasta el final
    });
    await page.waitForTimeout(200);

    // Las etiquetas de hora deben seguir visibles en el viewport tras el scroll total.
    // Si la columna NO fuera sticky, quedarían fuera de pantalla y toBeVisible() fallaría.
    await expect(page.getByText('09:00hs')).toBeVisible();
    await expect(page.getByText('10:00hs')).toBeVisible();
    await expect(page.getByText('11:00hs')).toBeVisible();

    // Confirmamos además que siguen ancladas a la izquierda del viewport (x ≈ 0).
    const labelLeft = await page.getByText('09:00hs').evaluate(
      (el) => el.getBoundingClientRect().left,
    );
    // El panel izquierdo mide w-20 = 80 px. La etiqueta debe estar dentro de él
    // (x entre 0 y 80), nunca off-screen hacia la izquierda (< 0) ni más allá del panel.
    expect(labelLeft).toBeGreaterThanOrEqual(0);
    expect(labelLeft).toBeLessThan(80); // ancho del panel de horas (w-20)
  });

  // ── 4. Abrir modal al tocar un slot disponible ────────────────────────────
  test('tocar un slot disponible abre el modal de reserva', async ({ page }) => {
    // Esperar a que carguen los slots
    const primerSlot = page
      .getByRole('button', { name: 'Disponible' })
      .first();
    await expect(primerSlot).toBeVisible({ timeout: 8_000 });

    await primerSlot.click();

    // El modal debe aparecer
    const modal = page.getByTestId('booking-modal');
    await expect(modal).toBeVisible({ timeout: 3_000 });
  });

  // ── 5. El modal es responsivo: no desborda la pantalla ───────────────────
  test('el modal de reserva cabe dentro del viewport móvil sin overflow', async ({
    page,
  }) => {
    // Abrir el modal
    const primerSlot = page
      .getByRole('button', { name: 'Disponible' })
      .first();
    await expect(primerSlot).toBeVisible({ timeout: 8_000 });
    await primerSlot.click();

    const modal = page.getByTestId('booking-modal');
    await expect(modal).toBeVisible({ timeout: 3_000 });

    // Usamos getBoundingClientRect() + window.innerWidth dentro de page.evaluate()
    // para que AMBAS medidas estén en CSS pixels sin ambigüedad.
    // boundingBox() + viewportSize() pueden tener unidades distintas cuando
    // deviceScaleFactor > 1 en Playwright Chromium.
    const overflow = await modal.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return {
        leftOk:   rect.left >= 0,
        rightOk:  rect.right <= vw + 1,   // +1 px tolerancia por redondeo
        heightOk: rect.height <= vh * 0.92,
        debug: { left: rect.left, right: rect.right, width: rect.width, vw, vh },
      };
    });

    expect(overflow.leftOk,   `Modal desborda por la izquierda: ${JSON.stringify(overflow.debug)}`).toBe(true);
    expect(overflow.rightOk,  `Modal desborda por la derecha: ${JSON.stringify(overflow.debug)}`).toBe(true);
    expect(overflow.heightOk, `Modal demasiado alto: ${JSON.stringify(overflow.debug)}`).toBe(true);
  });

  // ── 6. El modal se puede cerrar desde mobile ──────────────────────────────
  test('el modal se cierra al pulsar el botón X', async ({ page }) => {
    const primerSlot = page
      .getByRole('button', { name: 'Disponible' })
      .first();
    await expect(primerSlot).toBeVisible({ timeout: 8_000 });
    await primerSlot.click();

    const modal = page.getByTestId('booking-modal');
    await expect(modal).toBeVisible({ timeout: 3_000 });

    // Cerrar con el botón X (aria-label="Cerrar")
    await page.getByRole('button', { name: 'Cerrar' }).first().click();
    await expect(modal).not.toBeVisible({ timeout: 2_000 });

    // La grilla sigue siendo visible después de cerrar el modal
    await expect(page.getByRole('heading', { name: 'Agenda de Canchas' })).toBeVisible();
  });
});
