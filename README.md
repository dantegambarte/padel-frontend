# La Caldera — Sistema de Gestión de Canchas de Padel

Frontend desarrollado en **Angular 15** con **TailwindCSS** para la gestión integral de un club de padel: reservas de canchas, punto de venta, cierre de caja, inventario, reportes, egresos y administración de usuarios.

---

## Stack tecnológico

| Capa             | Tecnología                    |
| ---------------- | ----------------------------- |
| Framework        | Angular 15.2                  |
| Estilos          | TailwindCSS 3.4 + SCSS        |
| Gráficos         | Chart.js 4.5 + ng2-charts 4.1 |
| Alertas/Modales  | SweetAlert2 11                |
| Exportación      | XLSX 0.18                     |
| Testing unitario | Karma + Jasmine               |
| Testing E2E      | Playwright 1.58               |
| Lenguaje         | TypeScript 4.9 (strict mode)  |
| Target JS        | ES2022                        |

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

| Comando                   | Descripción                                   |
| ------------------------- | --------------------------------------------- |
| `npm start`               | Servidor de desarrollo en `localhost:4200`    |
| `npm run build`           | Build de producción en `dist/padel-frontend/` |
| `npm run watch`           | Build en modo watch (desarrollo)              |
| `npm test`                | Tests unitarios con Karma + Jasmine           |
| `npm run test:e2e`        | Tests E2E headless con Playwright             |
| `npm run test:e2e:ui`     | Tests E2E en modo UI interactivo              |
| `npm run test:e2e:report` | Ver reporte HTML del último run               |

---

## Configuración de entorno

Los archivos de entorno están en `src/environments/`:

**`environment.ts`** (desarrollo)

```ts
export const environment = {
  production: false,
  apiUrl: "http://localhost:3000/api/v1",
};
```

**`environment.prod.ts`** (producción)

```ts
export const environment = {
  production: true,
  apiUrl: "https://TU_DOMINIO.com/api/v1", // ← reemplazar antes de deployar
};
```

> El `apiUrl` de desarrollo puede apuntar a un DevTunnel de VS Code si se trabaja con el backend remoto.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── core/                             # Servicios singleton, modelos, guards, interceptors
│   │   ├── guards/
│   │   │   ├── auth.guard.ts             # Protege rutas autenticadas
│   │   │   ├── admin.guard.ts            # Restringe rutas solo a administradores
│   │   │   └── unsaved-changes.guard.ts  # Alerta al navegar con cambios sin guardar
│   │   ├── interceptors/
│   │   │   └── jwt.interceptor.ts        # Adjunta el token JWT + manejo de refresh
│   │   ├── models/                       # Interfaces y tipos del dominio
│   │   │   ├── booking.model.ts
│   │   │   ├── court.model.ts
│   │   │   ├── expense.model.ts
│   │   │   ├── notification.model.ts
│   │   │   ├── pricing-shift.model.ts
│   │   │   ├── product.model.ts
│   │   │   ├── teacher.model.ts
│   │   │   └── user.model.ts
│   │   └── services/                     # Servicios HTTP y lógica de negocio
│   │       ├── auth.service.ts
│   │       ├── bookings.service.ts
│   │       ├── calculator.service.ts
│   │       ├── cash.service.ts
│   │       ├── config.service.ts
│   │       ├── courts.service.ts
│   │       ├── expenses.service.ts
│   │       ├── fixed-bookings.service.ts
│   │       ├── notification.service.ts
│   │       ├── pricing-shifts.service.ts
│   │       ├── products.service.ts
│   │       ├── reminders-api.service.ts
│   │       ├── reports.service.ts
│   │       ├── sales.service.ts
│   │       ├── search.service.ts
│   │       ├── draft.service.ts
│   │       ├── session-alert.service.ts
│   │       ├── teachers.service.ts
│   │       ├── theme.service.ts
│   │       ├── toast.service.ts
│   │       └── users.service.ts
│   │
│   ├── features/                         # Módulos funcionales (lazy-loaded)
│   │   ├── auth/                         # Login y autenticación JWT
│   │   ├── layout/                       # Shell: sidebar + toolbar + rutas hijas
│   │   ├── dashboard/                    # Panel de métricas (vista admin y empleado)
│   │   ├── schedule/                     # Agenda de turnos y reservas de canchas
│   │   ├── fixed-bookings/               # Gestión de turnos fijos / abonos
│   │   ├── cash-register/                # Apertura y cierre de turno de caja
│   │   ├── pos/                          # Punto de Venta — nueva venta
│   │   ├── products/                     # Gestión de productos e inventario
│   │   ├── expenses/                     # Registro de egresos (solo admin)
│   │   ├── pricing-shifts/               # Franjas horarias de precios (solo admin)
│   │   ├── reports/                      # Reportes de ventas e ingresos
│   │   ├── teachers/                     # Gestión de profesores y recordatorios
│   │   ├── users/                        # Administración de usuarios y roles
│   │   ├── settings/                     # Configuración del sistema
│   │   ├── inventory/                    # Alertas de stock bajo (solo admin)
│   │   └── account/                      # Perfil del usuario autenticado
│   │
│   └── shared/                           # Componentes y directivas reutilizables
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
    ├── bookings.spec.ts
    ├── cash-register.spec.ts
    ├── chaos-paths.spec.ts
    ├── dashboard.spec.ts
    ├── navigation.spec.ts
    ├── pos.spec.ts
    ├── products.spec.ts
    ├── reports.spec.ts
    ├── schedule.spec.ts
    ├── schedule.mobile.spec.ts
    ├── settings.spec.ts
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
  ├── fixed-bookings     → Turnos fijos / abonos
  ├── cash-register      → Apertura y cierre de turno de caja
  ├── pos                → Nueva venta (Punto de Venta)
  ├── products           → Gestión de productos e inventario
  ├── expenses           → Egresos del turno (solo admin — AdminGuard)
  ├── pricing-shifts     → Franjas horarias de precios (solo admin — AdminGuard)
  ├── inventory          → Alertas de stock bajo (solo admin — AdminGuard)
  ├── reports            → Reportes de ventas
  ├── teachers           → Gestión de profesores
  ├── users              → Gestión de usuarios
  ├── settings           → Configuración del sistema
  └── account            → Mi cuenta / perfil
**                       → redirect a /auth/login
```

Todos los módulos dentro de `/app` son **lazy-loaded** y protegidos por `AuthGuard`. El `JwtInterceptor` adjunta automáticamente el token Bearer a cada petición HTTP e intercepta errores 401 para refrescar el token o forzar logout.

---

## Roles de usuario

| Rol        | Descripción                                                                 |
| ---------- | --------------------------------------------------------------------------- |
| `admin`    | Acceso completo a todos los módulos, incluidos egresos y franjas de precios |
| `employee` | Dashboard simplificado, POS, agenda, caja y turnos fijos                    |

Las rutas exclusivas de admin están protegidas en dos capas: **`AdminGuard`** (ruta) y visibilidad en el sidebar (solo se muestra el ítem si el rol es `admin`).

---

## Módulo de Caja (`cash-register`)

Gestiona la apertura y cierre de turnos de caja por jornada comercial.

- Apertura de turno con fondo inicial (se sugiere el saldo arrastrado del último cierre)
- Alerta visual si existe un turno abierto de un día anterior sin cerrar (stale session)
- Detección de jornada comercial ya cerrada al intentar abrir un nuevo turno
- Panel de cierre con desglose: fondo inicial, ingresos en efectivo, egresos en efectivo, efectivo a rendir y transferencias
- Exportación del resumen de cierre (Z-close) a Excel
- Impresión de ticket en la misma pestaña

---

## Módulo POS — Punto de Venta

El módulo de nueva venta cuenta con un diseño **completamente responsive** que se adapta a cualquier dispositivo.

### Layouts por breakpoint

| Dispositivo       | Breakpoint       | Comportamiento                                                          |
| ----------------- | ---------------- | ----------------------------------------------------------------------- |
| Mobile            | `< 768px`        | Catálogo full-screen + bottom sheet deslizable (swipe down para cerrar) |
| Tablet / Nest Hub | `768px – 1279px` | Grid de 2 columnas con panel lateral en **tabs de 2 pasos**             |
| Desktop grande    | `≥ 1280px`       | Panel lateral con scroll continuo (ítems + pago simultáneos)            |

### Funcionalidades

- Búsqueda de productos en tiempo real con normalización de acentos
- Validación de stock por unidad (excepto categoría "Alquileres", sin límite — muestra ∞)
- Pago mixto: efectivo + transferencia bancaria
- Cálculo automático de vuelto / faltante
- Wizard de 2 pasos en mobile y pantallas cortas (Ítems → Pago)
- Modal de detalle por producto (precio, stock, subtotal)
- Ticket de venta descargable tras confirmar
- Bloqueo preventivo si la caja está cerrada, con prompt para ir a abrirla

---

## Módulo de Precios (`pricing-shifts`)

Motor de franjas horarias para precios dinámicos de canchas.

- Reemplaza el sistema de precios estáticos por cancha (eliminados de `court.model`)
- Permite definir franjas con nombre, rango horario y precio por duración
- Accesible solo para administradores

---

## Módulo de Egresos (`expenses`)

Registro de gastos operativos por turno de caja.

- Crea, lista y gestiona egresos asociados a una sesión de caja
- Los egresos en efectivo se descuentan del efectivo a rendir en el cierre
- Accesible solo para administradores

---

## Módulo de Agenda (`schedule`)

- Grilla de canchas con columnas fijas (sticky) y scroll horizontal
- Drag-and-drop para reprogramar reservas con diálogo de confirmación
- Drag deshabilitado para turnos con estado `completed`
- Tooltip con hora al pasar el cursor por slots libres
- Soporte para reservas multi-slot y visualización por duración
- Cabeceras de canchas sticky al hacer scroll vertical

---

## Módulo de Turnos Fijos (`fixed-bookings`)

- CRUD de abonos / turnos fijos semanales
- Precio calculado por el motor de franjas horarias (no por campos estáticos de la cancha)

---

## Módulo de Profesores (`teachers`)

- Alta, edición y baja lógica de profesores
- Recordatorios configurables por profesor
- Reservas de canchas asignadas a profesor con duración forzada a 60 minutos
- Guard `canDeactivate` para proteger cambios no guardados

---

## Módulo de Reportes (`reports`)

- Filtros rápidos por período con pills predefinidas (Hoy, Semana, Mes, etc.)
- Selector de fecha exacta para filtros personalizados
- Gráficos de ingresos, métodos de pago y ranking de productos
- Exportación a Excel

---

## Módulo de Productos (`products`)

- CRUD de productos con categorías dinámicas
- Campo de icono por producto con autosugerencia según categoría y selector visual
- Distinción entre productos de alquiler (stock ilimitado — ∞) y productos normales
- Badge de stock con alerta visual cuando baja de 10 unidades

---

## Módulo de Inventario (`inventory`)

Panel de alertas de stock bajo accesible solo para administradores.

- Lista todos los productos cuyo stock es inferior al umbral mínimo configurado
- Separa en dos secciones: **Sin stock** (stock = 0) y **Stock bajo** (stock > 0 pero por debajo del mínimo)
- Barra de progreso visual por producto: porcentaje de stock restante respecto al umbral mínimo
- Acceso directo al producto desde la alerta (navega a `/app/products?highlight=:id`)
- Botón de recarga manual

---

## Tema oscuro

El `ThemeService` gestiona el modo oscuro de la aplicación.

- Detecta la preferencia del sistema (`prefers-color-scheme: dark`) en el primer arranque
- Persiste la elección del usuario en `localStorage` (clave `padelsys-theme`)
- Expone `isDark$` (BehaviorSubject) para que los componentes reaccionen al cambio
- El toggle agrega/quita la clase `dark` en el `<html>` (compatible con Tailwind dark mode)

---

## Borradores persistentes (`DraftService`)

Utilidad para preservar formularios ante recargas o pérdidas de conexión.

- Guarda cualquier estado serializable en `localStorage` bajo una clave arbitraria
- Métodos: `saveDraft`, `getDraft<T>`, `clearDraft`, `hasDraft`
- Falla silenciosamente si el storage no está disponible o está lleno

---

## Caché y rendimiento

Los servicios de mayor demanda implementan una caché con TTL para evitar peticiones redundantes:

| Servicio          | Método cacheado                           | TTL  |
| ----------------- | ----------------------------------------- | ---- |
| `CashService`     | `getCurrent()`                            | 10 s |
| `ReportsService`  | `getTodayKpis()`, `getLast7DaysRevenue()` | 10 s |
| `CourtsService`   | `findAll()`                               | 60 s |
| `ProductsService` | `findAll()`                               | 60 s |
| `TeachersService` | `findAll()`                               | 60 s |

Las cachés se invalidan automáticamente al logout y al realizar mutaciones (POST/PATCH/DELETE).

---

## Guards disponibles

| Guard                 | Uso                                                                     |
| --------------------- | ----------------------------------------------------------------------- |
| `AuthGuard`           | Protege todas las rutas dentro de `/app`                                |
| `AdminGuard`          | Restringe acceso a `expenses`, `pricing-shifts` e `inventory` a rol `admin` |
| `UnsavedChangesGuard` | Alerta antes de navegar si hay cambios sin guardar (settings, teachers) |

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

| Archivo                       | Descripción                                           |
| ----------------------------- | ----------------------------------------------------- |
| `e2e/auth.spec.ts`            | Login, validaciones, guards de ruta                   |
| `e2e/bookings.spec.ts`        | Creación y gestión de reservas                        |
| `e2e/cash-register.spec.ts`   | Apertura y cierre de turno de caja                    |
| `e2e/chaos-paths.spec.ts`     | Navegación a rutas inválidas y edge cases             |
| `e2e/dashboard.spec.ts`       | Métricas, resumen del día, métodos de pago, navbar    |
| `e2e/navigation.spec.ts`      | Navegación a todas las secciones                      |
| `e2e/pos.spec.ts`             | Flujo de venta completo                               |
| `e2e/expenses.spec.ts`        | Registro de egresos — roles admin y empleado          |
| `e2e/products.spec.ts`        | CRUD de productos                                     |
| `e2e/reports.spec.ts`         | Filtros de período y gráficos                         |
| `e2e/schedule.spec.ts`        | Grilla de canchas, reservas, slots, selector de fecha |
| `e2e/schedule.mobile.spec.ts` | Vista mobile de agenda                                |
| `e2e/settings.spec.ts`        | Configuración del sistema                             |

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

| Tipo                   | Warning | Error |
| ---------------------- | ------- | ----- |
| Bundle inicial         | 500 KB  | 1 MB  |
| Estilos por componente | 2 KB    | 4 KB  |
