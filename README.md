# PadelSys — Sistema de Gestión de Canchas de Padel

Frontend desarrollado en **Angular 15** con **TailwindCSS** para la gestión integral de un club de padel: reservas de canchas, punto de venta, cierre de caja, inventario, reportes y administración de usuarios.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Angular 15.2 |
| Estilos | TailwindCSS 3.4 + SCSS |
| Gráficos | Chart.js 4.5 + ng2-charts 4.1 |
| Alertas/Modales | SweetAlert2 11 |
| Exportación | XLSX 0.18 |
| Testing unitario | Karma + Jasmine |
| Testing E2E | Playwright 1.58 |
| Lenguaje | TypeScript 4.9 (strict mode) |
| Target JS | ES2022 |

---

## Requisitos previos

- Node.js 18+
- npm 9+
- Angular CLI 15: `npm install -g @angular/cli@15`
- Backend corriendo (ver sección de entorno)

---

## Instalación y puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm start
# → http://localhost:4200
```

**Credenciales de demo:**
- Admin: `admin` / `admin123`
- Empleado: `empleado` / `empleado123`

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm start` | Servidor de desarrollo en `localhost:4200` |
| `npm run build` | Build de producción en `dist/padel-frontend/` |
| `npm run watch` | Build en modo watch (desarrollo) |
| `npm test` | Tests unitarios con Karma + Jasmine |
| `npm run test:e2e` | Tests E2E headless con Playwright |
| `npm run test:e2e:ui` | Tests E2E en modo UI interactivo |
| `npm run test:e2e:report` | Ver reporte HTML del último run |

---

## Configuración de entorno

Los archivos de entorno están en `src/environments/`:

**`environment.ts`** (desarrollo)
```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api/v1',
};
```

**`environment.prod.ts`** (producción)
```ts
export const environment = {
  production: true,
  apiUrl: 'https://TU_DOMINIO.com/api/v1', // ← reemplazar antes de deployar
};
```

> El `apiUrl` de desarrollo puede apuntar a un DevTunnel de VS Code si se trabaja con el backend remoto.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── core/                       # Servicios singleton, modelos, guards, interceptors
│   │   ├── guards/
│   │   │   └── auth.guard.ts       # Protege rutas autenticadas
│   │   ├── interceptors/
│   │   │   └── jwt.interceptor.ts  # Adjunta el token JWT a cada request HTTP
│   │   ├── models/                 # Interfaces y tipos del dominio
│   │   │   ├── booking.model.ts
│   │   │   ├── court.model.ts
│   │   │   ├── product.model.ts
│   │   │   └── user.model.ts
│   │   └── services/               # Servicios HTTP y lógica de negocio
│   │       ├── auth.service.ts
│   │       ├── bookings.service.ts
│   │       ├── cash.service.ts
│   │       ├── courts.service.ts
│   │       ├── products.service.ts
│   │       ├── reports.service.ts
│   │       ├── sales.service.ts
│   │       ├── session-alert.service.ts
│   │       ├── toast.service.ts
│   │       └── users.service.ts
│   │
│   ├── features/                   # Módulos funcionales (lazy-loaded)
│   │   ├── auth/                   # Login y autenticación JWT
│   │   ├── layout/                 # Shell: sidebar + toolbar + rutas hijas
│   │   ├── dashboard/              # Panel de métricas (vista admin y empleado)
│   │   ├── schedule/               # Agenda de turnos y reservas de canchas
│   │   ├── cash-register/          # Apertura y cierre de caja
│   │   ├── pos/                    # Punto de Venta — nueva venta
│   │   ├── products/               # Gestión de productos e inventario
│   │   ├── reports/                # Reportes de ventas e ingresos
│   │   ├── users/                  # Administración de usuarios y roles
│   │   ├── settings/               # Configuración del sistema
│   │   └── account/                # Perfil del usuario autenticado
│   │
│   └── shared/                     # Componentes y directivas reutilizables
│       ├── components/
│       │   ├── toast/
│       │   ├── calculator/
│       │   └── session-alert/
│       └── directives/
│           └── modal-scroll-lock/
│
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
│
└── e2e/
    ├── auth.spec.ts
    ├── dashboard.spec.ts
    ├── navigation.spec.ts
    ├── schedule.spec.ts
    └── global-setup.ts
```

---

## Rutas de la aplicación

```
/                        → redirect a /auth/login
/auth/login              → Pantalla de inicio de sesión
/app/                    → Shell protegido (requiere AuthGuard)
  ├── dashboard          → Panel de control con métricas
  ├── schedule           → Agenda de reservas de canchas
  ├── cash-register      → Cierre de caja
  ├── pos                → Nueva venta (Punto de Venta)
  ├── products           → Gestión de productos e inventario
  ├── reports            → Reportes de ventas
  ├── users              → Gestión de usuarios
  ├── settings           → Configuración del sistema
  └── account            → Mi cuenta / perfil
**                       → redirect a /auth/login
```

Todos los módulos dentro de `/app` son **lazy-loaded** y protegidos por `AuthGuard`. El `JwtInterceptor` adjunta automáticamente el token Bearer a cada petición HTTP.

---

## Roles de usuario

| Rol | Descripción |
|---|---|
| `admin` | Acceso completo a todos los módulos |
| `employee` | Dashboard simplificado, POS, agenda y caja |

---

## Módulo POS — Punto de Venta

El módulo de nueva venta cuenta con un diseño **completamente responsive** que se adapta a cualquier dispositivo:

### Layouts por breakpoint

| Dispositivo | Breakpoint | Comportamiento |
|---|---|---|
| Mobile | `< 768px` | Catálogo full-screen + bottom sheet deslizable (swipe down para cerrar) |
| Tablet / Nest Hub | `768px – 1279px` | Grid de 2 columnas con panel lateral en **tabs de 2 pasos** |
| Desktop grande | `≥ 1280px` | Panel lateral con scroll continuo (ítems + pago simultáneos) |

### Funcionalidades

- Búsqueda de productos en tiempo real con normalización de acentos
- Validación de stock por unidad (excepto categoría "Alquileres", sin límite)
- Pago mixto: efectivo + transferencia bancaria
- Cálculo automático de vuelto / faltante
- Wizard de 2 pasos en mobile y pantallas cortas (Ítems → Pago)
- Modal de detalle por producto (precio, stock, subtotal)
- Ticket de venta descargable tras confirmar
- Integración con apertura/cierre de caja (bloqueo si caja cerrada)

---

## Tests E2E con Playwright

Los tests cubren los flujos principales de la aplicación.

### Requisitos previos

```bash
# Terminal 1 — Backend
npm start   # en el proyecto backend

# Terminal 2 — Frontend
npm start   # en este proyecto
```

### Comandos

```bash
# Headless (CI/CD)
npm run test:e2e

# Modo UI interactivo (debug)
npm run test:e2e:ui

# Ver reporte HTML
npm run test:e2e:report
```

### Cobertura de tests

| Archivo | Tests | Descripción |
|---|---|---|
| `e2e/auth.spec.ts` | 7 | Login, validaciones, guards de ruta |
| `e2e/dashboard.spec.ts` | 8 | Métricas, resumen del día, métodos de pago, navbar |
| `e2e/navigation.spec.ts` | 8 | Navegación a todas las secciones |
| `e2e/schedule.spec.ts` | 6 | Grilla de canchas, reservas, slots, selector de fecha |

> `global-setup.ts` realiza un único login al inicio y guarda la sesión en `e2e/auth-state.json` (ignorado por git), evitando re-autenticación en cada test.

---

## Build de producción

```bash
npm run build
# Output: dist/padel-frontend/
```

Configurar el servidor web para redirigir todas las rutas al `index.html` (SPA routing).

**Ejemplo nginx:**
```nginx
location / {
  root /var/www/padel-frontend;
  try_files $uri $uri/ /index.html;
}
```

### Límites de bundle

| Tipo | Warning | Error |
|---|---|---|
| Bundle inicial | 500 KB | 1 MB |
| Estilos por componente | 2 KB | 4 KB |
