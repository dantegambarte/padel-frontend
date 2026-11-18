import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Public privacy notice (issue #70). Reachable without login. The club running
 * this instance is the data controller; bracketed fields are placeholders it
 * must fill in before going live.
 */
@Component({
  selector: 'app-privacy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto max-w-2xl px-4 py-10 text-slate-800 dark:text-slate-100">
      <h1 class="mb-6 text-2xl font-bold">Aviso de privacidad</h1>

      <section class="mb-6">
        <h2 class="mb-2 text-lg font-semibold">Responsable</h2>
        <p>
          El club que utiliza este sistema es el responsable del tratamiento de
          los datos: [nombre del club], [domicilio].
        </p>
      </section>

      <section class="mb-6">
        <h2 class="mb-2 text-lg font-semibold">Qué datos tratamos</h2>
        <ul class="list-disc pl-6">
          <li>Cuentas del personal: nombre de usuario, nombre y rol.</li>
          <li>Clientes: nombre y teléfono asociados a las reservas.</li>
          <li>Registros operativos: ventas, caja y gastos del club.</li>
        </ul>
      </section>

      <section class="mb-6">
        <h2 class="mb-2 text-lg font-semibold">Para qué</h2>
        <p>
          Gestionar reservas de canchas, contactar al cliente sobre su reserva y
          llevar la administración interna del club. No se venden ni se ceden
          datos a terceros con fines comerciales.
        </p>
      </section>

      <section class="mb-6">
        <h2 class="mb-2 text-lg font-semibold">Conservación</h2>
        <p>
          Los datos se conservan durante [plazo definido por el club] o mientras
          sean necesarios para las finalidades indicadas.
        </p>
      </section>

      <section class="mb-6">
        <h2 class="mb-2 text-lg font-semibold">Contacto</h2>
        <p>
          Para acceder, rectificar o suprimir tus datos, escribí a [correo de
          contacto del club].
        </p>
      </section>

      <p class="text-sm">
        <a class="underline" href="/3rdpartylicenses.txt">Licencias de terceros</a>
        ·
        <a class="underline" href="/auth/login">Volver al inicio</a>
      </p>
    </main>
  `,
})
export class PrivacyComponent {}
