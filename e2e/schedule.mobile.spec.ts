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
    await expect(
      page.getByRole('heading', { name: 'Agenda de Canchas' }),
    ).toBeVisible({
      timeout: 10_000,
    });
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const datePicker = page.locator('input[type="date"]').first();
    await datePicker.fill(futureDate);
    await datePicker.dispatchEvent('change');
    await page.waitForLoadState('networkidle');
  });

  test('el body no desborda horizontalmente — el scroll es interno a la grilla', async ({
    page,
  }) => {
    const viewportWidth = page.viewportSize()!.width;

    const bodyScrollWidth = await page.evaluate(
      () => document.body.scrollWidth,
    );

    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('el contenedor de la grilla tiene scroll horizontal interno', async ({
    page,
  }) => {
    const gridScrollable = await page.evaluate(() => {
      const el = document.querySelector(
        '.overflow-x-auto',
      ) as HTMLElement | null;
      if (!el) return null;
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowX: getComputedStyle(el).overflowX,
      };
    });

    expect(gridScrollable).not.toBeNull();
    expect(gridScrollable!.overflowX).toBe('auto');
    expect(gridScrollable!.scrollWidth).toBeGreaterThan(
      gridScrollable!.clientWidth,
    );
  });

  test('la etiqueta de hora permanece visible al hacer scroll lateral en la grilla', async ({
    page,
  }) => {
    const gridContainer = page.locator('.overflow-x-auto').first();
    await expect(gridContainer).toBeVisible();

    await gridContainer.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await page.waitForTimeout(200);

    await expect(page.getByText('09:00hs')).toBeVisible();
    await expect(page.getByText('10:00hs')).toBeVisible();
    await expect(page.getByText('11:00hs')).toBeVisible();

    const labelLeft = await page
      .getByText('09:00hs')
      .evaluate((el) => el.getBoundingClientRect().left);
    expect(labelLeft).toBeGreaterThanOrEqual(0);
    expect(labelLeft).toBeLessThan(80);
  });

  test('tocar un slot disponible abre el modal de reserva', async ({
    page,
  }) => {
    const primerSlot = page.getByRole('button', { name: 'Disponible' }).first();
    await expect(primerSlot).toBeVisible({ timeout: 8_000 });

    await primerSlot.click();

    const modal = page.getByTestId('booking-modal');
    await expect(modal).toBeVisible({ timeout: 3_000 });
  });

  test('el modal de reserva cabe dentro del viewport móvil sin overflow', async ({
    page,
  }) => {
    const primerSlot = page.getByRole('button', { name: 'Disponible' }).first();
    await expect(primerSlot).toBeVisible({ timeout: 8_000 });
    await primerSlot.click();

    const modal = page.getByTestId('booking-modal');
    await expect(modal).toBeVisible({ timeout: 3_000 });

    const overflow = await modal.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return {
        leftOk: rect.left >= 0,
        rightOk: rect.right <= vw + 1,
        heightOk: rect.height <= vh * 0.92,
        debug: {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          vw,
          vh,
        },
      };
    });

    expect(
      overflow.leftOk,
      `Modal desborda por la izquierda: ${JSON.stringify(overflow.debug)}`,
    ).toBe(true);
    expect(
      overflow.rightOk,
      `Modal desborda por la derecha: ${JSON.stringify(overflow.debug)}`,
    ).toBe(true);
    expect(
      overflow.heightOk,
      `Modal demasiado alto: ${JSON.stringify(overflow.debug)}`,
    ).toBe(true);
  });

  test('el modal se cierra al pulsar el botón X', async ({ page }) => {
    const primerSlot = page.getByRole('button', { name: 'Disponible' }).first();
    await expect(primerSlot).toBeVisible({ timeout: 8_000 });
    await primerSlot.click();

    const modal = page.getByTestId('booking-modal');
    await expect(modal).toBeVisible({ timeout: 3_000 });

    await page.getByRole('button', { name: 'Cerrar' }).first().click();
    await expect(modal).not.toBeVisible({ timeout: 2_000 });

    await expect(
      page.getByRole('heading', { name: 'Agenda de Canchas' }),
    ).toBeVisible();
  });
});
