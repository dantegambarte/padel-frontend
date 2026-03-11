# La Caldera — Sistema de Gestión de Canchas de Pádel

Frontend desarrollado en **Angular 15** con Tailwind CSS para la gestión de canchas de pádel: agenda de turnos, punto de venta, cierre de caja, reportes y administración de usuarios.

---

## Requisitos previos

- Node.js 18+
- Angular CLI 15
- Backend corriendo en `http://localhost:3000`

---

## Instalación

```bash
npm install
```

---

## Desarrollo

```bash
npm start
```

Abre `http://localhost:4200`. La app recarga automáticamente al modificar archivos fuente.

**Credenciales de demo:**
- Admin: `admin` / `admin123`
- Empleado: `empleado` / `empleado123`

---

## Build

```bash
npm run build
```

Los artefactos se generan en `dist/`.

---

## Tests unitarios

```bash
npm test
```

Ejecuta los unit tests con [Karma](https://karma-runner.github.io).

---

## Tests E2E con Playwright

Los tests end-to-end cubren los flujos principales de la aplicación usando [Playwright](https://playwright.dev).

### Requisitos

Tener el backend y el frontend corriendo antes de ejecutar los tests:

```bash
# Terminal 1 — Backend
npm start   # en el proyecto backend

# Terminal 2 — Frontend
npm start   # en este proyecto
```

### Comandos

```bash
# Correr todos los tests (headless)
npm run test:e2e

# Correr en modo UI interactivo (recomendado para desarrollo)
npm run test:e2e:ui

# Ver el reporte HTML del último run
npm run test:e2e:report
```

### Cobertura de tests

| Archivo | Tests | Descripción |
|---|---|---|
| `e2e/auth.spec.ts` | 7 | Formulario de login, validaciones, guards de ruta |
| `e2e/dashboard.spec.ts` | 8 | Métricas, resumen del día, métodos de pago, navbar |
| `e2e/navigation.spec.ts` | 8 | Navegación a todas las secciones de la app |
| `e2e/schedule.spec.ts` | 6 | Grilla de canchas, reservas, slots, selector de fecha |

### Estructura

```
e2e/
├── auth.spec.ts          # Tests de autenticación
├── dashboard.spec.ts     # Tests del dashboard
├── navigation.spec.ts    # Tests de navegación
├── schedule.spec.ts      # Tests de agenda de turnos
├── global-setup.ts       # Login único compartido entre tests
playwright.config.ts      # Configuración de Playwright
```

> El `global-setup.ts` realiza un único login al inicio y guarda la sesión en `e2e/auth-state.json` (ignorado por git) para que los tests no necesiten autenticarse individualmente, haciendo el suite más rápido.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── core/             # Guards, interceptors, módulo core
│   ├── features/
│   │   ├── auth/         # Login
│   │   └── layout/       # Shell principal con sidebar
│   └── environments/     # Variables de entorno
```
