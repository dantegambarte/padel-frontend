import { test, expect } from '@playwright/test';

// Los tests de auth no usan storageState (necesitan estar deslogueados)
test.describe('Autenticación', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('debe mostrar el formulario de login', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'La Caldera' })).toBeVisible();
    await expect(page.getByText('Sistema de Gestión de Canchas de Pádel')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Usuario' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Contraseña' })).toBeVisible();
  });

  test('el botón debe estar deshabilitado con campos vacíos', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Iniciar Sesión' })).toBeDisabled();
  });

  test('el botón se habilita al completar ambos campos', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Usuario' }).fill('admin');
    await page.getByRole('textbox', { name: 'Contraseña' }).fill('admin123');
    await expect(page.getByRole('button', { name: 'Iniciar Sesión' })).toBeEnabled();
  });

  test('login exitoso como Administrador redirige al dashboard', async ({ page }) => {
    test.slow();
    await page.getByRole('textbox', { name: 'Usuario' }).fill('admin');
    await page.getByRole('textbox', { name: 'Contraseña' }).fill('admin123');

    const loginResponse = page.waitForResponse(
      (res) => res.url().includes('/auth') && res.status() === 200,
      { timeout: 10000 }
    );
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await loginResponse.catch(() => {}); // espera pero no falla si no coincide

    await expect(page).toHaveURL('/app/dashboard', { timeout: 15000 });
    await expect(page.getByText('Modo Administrador')).toBeVisible();
  });

  test('login exitoso como Empleado redirige al dashboard', async ({ page }) => {
    test.slow();
    await page.getByRole('textbox', { name: 'Usuario' }).fill('empleado');
    await page.getByRole('textbox', { name: 'Contraseña' }).fill('empleado123');

    const loginResponse = page.waitForResponse(
      (res) => res.url().includes('/auth') && res.status() === 200,
      { timeout: 10000 }
    );
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await loginResponse.catch(() => {});

    await expect(page).toHaveURL('/app/dashboard', { timeout: 15000 });
  });

  test('credenciales inválidas no permiten acceder', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Usuario' }).fill('usuario_invalido');
    await page.getByRole('textbox', { name: 'Contraseña' }).fill('clave_incorrecta');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    await page.waitForTimeout(1500);
    await expect(page).not.toHaveURL('/app/dashboard');
  });

  test('redirige a login si accede sin autenticación', async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/auth\/login/);
  });
});
