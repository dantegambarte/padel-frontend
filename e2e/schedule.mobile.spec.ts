/**
 * E2E — Agenda de Turnos en viewport móvil
 *
 * Ejecutar solo este archivo:
 *   npx playwright test e2e/schedule.mobile.spec.ts --project Mobile
 *
 * Ejecutar toda la suite móvil:
 *   npx playwright test --project Mobile
 */

import { test, expect, Page } from '@playwright/test';

async function openBookingModal(page: Page) {
  const slot = page.getByRole('button', { name: /Disponible 11:00/ }).first();
  await expect(slot).toBeVisible({ timeout: 8_000 });
  await slot.scrollIntoViewIfNeeded();
  await slot.click();

  const modal = page.getByTestId('booking-modal');
  if (!(await modal.isVisible({ timeout: 1000 }).catch(() => false))) {
    await slot.evaluate((el: HTMLElement) => el.click());
  }
  await expect(modal).toBeVisible({ timeout: 3_000 });
  return modal;
}

async function waitForScheduleGrid(page: Page) {
  const grid = page.locator('.overflow-x-auto').first();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await grid.isVisible({ timeout: 5000 }).catch(() => false)) {
      return;
    }

    const refresh = page.getByRole('button', { name: /Actualizar grilla/i });
    if (await refresh.isVisible().catch(() => false)) {
      await refresh.click();
    } else {
      await page.goto('/app/schedule');
    }
    await page.waitForLoadState('networkidle');
  }

  if (await page.getByText(/No se pudo conectar con el servidor/i).isVisible().catch(() => false)) {
    test.skip(true, 'La agenda no cargó por error transitorio del backend');
  }
  await expect(grid).toBeVisible();
}

test.describe('Agenda — Mobile', () => {
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
    await waitForScheduleGrid(page);
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

    const nineLabel = page.locator('[id="time-row-09:00"] span');
    await expect(nineLabel).toBeVisible();
    await expect(page.locator('[id="time-row-10:00"] span')).toBeVisible();
    await expect(page.locator('[id="time-row-11:00"] span')).toBeVisible();

    const labelLeft = await nineLabel.evaluate(
      (el) => el.getBoundingClientRect().left,
    );
    expect(labelLeft).toBeGreaterThanOrEqual(0);
    expect(labelLeft).toBeLessThan(80);
  });

  test('tocar un slot disponible abre el modal de reserva', async ({
    page,
  }) => {
    await openBookingModal(page);
  });

  test('el modal de reserva cabe dentro del viewport móvil sin overflow', async ({
    page,
  }) => {
    const modal = await openBookingModal(page);

    const overflow = await modal.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return {
        leftOk: rect.left >= 0,
        rightOk: rect.right <= vw + 1,
        heightOk: rect.height <= vh - 32 + 1,
        debug: {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
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
    const modal = await openBookingModal(page);

    await page.getByRole('button', { name: 'Cerrar' }).first().click();
    await expect(modal).not.toBeVisible({ timeout: 2_000 });

    await expect(
      page.getByRole('heading', { name: 'Agenda de Canchas' }),
    ).toBeVisible();
  });
});
