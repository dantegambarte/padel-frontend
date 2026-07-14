import { Component, EventEmitter, OnInit, Output, signal } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';

import { RowState } from 'src/app/core/models/internal-consumption.model';
import { Product } from '../../../core/models/product.model';
import { Teacher } from '../../../core/models/teacher.model';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { InternalConsumptionService } from '../../../core/services/internal-consumption.service';
import { ProductsService } from '../../../core/services/products.service';
import { TeachersService } from '../../../core/services/teachers.service';
import { UsersService } from '../../../core/services/users.service';
import { NgIf, NgFor } from '@angular/common';
import { ModalScrollLockDirective } from '../../../shared/modal-scroll-lock.directive';
import { DisableScrollDirective } from '../../../shared/directives/disable-scroll.directive';

@Component({
    selector: 'app-internal-consumption-form',
    templateUrl: './internal-consumption-form.component.html',
    imports: [
        NgIf,
        ModalScrollLockDirective,
        ReactiveFormsModule,
        NgFor,
        DisableScrollDirective,
    ],
})
export class InternalConsumptionFormComponent implements OnInit {
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  submitting = signal(false);
  serverError = signal<string | null>(null);
  loadingData = signal(true);

  products = signal<Product[]>([]);
  teachers = signal<Teacher[]>([]);
  users = signal<User[]>([]);

  /** Mutado in-place por fila (search/filtered/showDropdown); queda fuera de la
   * conversión a signals — la CD por zona ya lo maneja bien y la estructura
   * anidada no vale el riesgo de reescribirla a semántica inmutable. */
  rowStates: RowState[] = [];

  consumerSearch = signal('');
  filteredTeachers = signal<Teacher[]>([]);
  filteredUsers = signal<User[]>([]);
  showConsumerDropdown = signal(false);
  selectedConsumerName = signal('');

  showWhatsAppPrompt = signal(false);
  whatsAppUrl = signal('');
  savedTeacherName = signal('');

  /**
   * Getters para facilitar la lógica de la plantilla y mantener el código organizado.
   */
  get consumerType(): string {
    return this.form.get('consumerType')?.value ?? 'teacher';
  }

  /**
   * Getters para acceder a los controles del formulario y su estado de validación.
   */
  get isTeacher(): boolean {
    return this.consumerType === 'teacher';
  }

  /**
   * Getters para determinar si se puede enviar el formulario, verificando que se haya seleccionado un consumidor y al menos un producto válido.
   */
  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  /**
   * Getters para determinar si se puede enviar el formulario, verificando que se haya seleccionado un consumidor y al menos un producto válido.
   */
  get itemControls(): AbstractControl[] {
    return this.itemsArray.controls;
  }

  /**
   * Getters para determinar si se puede enviar el formulario, verificando que se haya seleccionado un consumidor y al menos un producto válido.
   */
  get canSubmit(): boolean {
    const { consumerType, teacherId, userId } = this.form.getRawValue();
    const consumerSelected =
      consumerType === 'teacher' ? !!teacherId : !!userId;
    const hasProduct = this.itemsArray.controls.some(
      (ctrl) => !!ctrl.get('productId')?.value,
    );
    return consumerSelected && hasProduct && !this.submitting();
  }

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private service: InternalConsumptionService,
    private productsService: ProductsService,
    private teachersService: TeachersService,
    private usersService: UsersService,
  ) {}

  ngOnInit(): void {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const defaultType =
      this.authService.currentUser?.role === 'employee' ? 'staff' : 'teacher';
    this.form = this.fb.group({
      consumerType: [defaultType, Validators.required],
      userId: [null],
      teacherId: [null],
      notes: [''],
      date: [today, Validators.required],
      items: this.fb.array([]),
    });

    const isEmployee = this.authService.currentUser?.role === 'employee';
    const usersCall = isEmployee ? of([]) : this.usersService.findAll();

    forkJoin({
      products: this.productsService.findAll(),
      teachers: this.teachersService.findAll(false),
      users: usersCall,
    }).subscribe({
      next: ({ products, teachers, users }) => {
        this.products.set(products.filter((p) => p.isActive && p.stock > 0));
        this.teachers.set(teachers);
        this.users.set(
          isEmployee
            ? this.authService.currentUser
              ? [this.authService.currentUser]
              : []
            : users.filter((u) => u.isActive),
        );
        this.filteredTeachers.set(this.teachers());
        this.filteredUsers.set(this.users());
        this.loadingData.set(false);
        this.addRow();
        this.tryAutofillEmployee();
      },
      error: () => {
        this.serverError.set('No se pudieron cargar los datos. Intente de nuevo.');
        this.loadingData.set(false);
      },
    });

    this.form.get('consumerType')!.valueChanges.subscribe(() => {
      this.form.patchValue({ userId: null, teacherId: null });
      this.consumerSearch.set('');
      this.selectedConsumerName.set('');
      this.showConsumerDropdown.set(false);
      this.filteredTeachers.set(this.teachers());
      this.filteredUsers.set(this.users());
      this.tryAutofillEmployee();
    });
  }

  /**
   * Método para intentar autocompletar el consumidor si el usuario logueado es un empleado y el tipo de consumidor seleccionado es "staff". Busca una coincidencia entre el ID del usuario logueado y la lista de usuarios activos, y si encuentra una coincidencia, selecciona automáticamente ese usuario como consumidor. Esto mejora la experiencia del usuario al reducir la cantidad de pasos necesarios para registrar un consumo interno para ellos mismos.
   */
  get isEmployeeRole(): boolean {
    return this.authService.currentUser?.role === 'employee';
  }

  private tryAutofillEmployee(): void {
    const loggedUser = this.authService.currentUser;
    if (loggedUser?.role === 'employee' && this.consumerType === 'staff') {
      const match = this.users().find((u) => u.id === loggedUser.id);
      if (match) {
        this.selectUser(match);
        this.form.get('userId')?.disable();
      }
    } else {
      this.form.get('userId')?.enable();
    }
  }

  /**
   *  Método para construir un nuevo FormGroup para una fila de producto, con validaciones para el ID del producto y la cantidad.
   * @returns
   */
  private buildRow(): FormGroup {
    return this.fb.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
    });
  }

  /**
   * Método para agregar una nueva fila de producto al formulario, inicializando su estado de búsqueda y filtrado para la selección del producto.
   */
  addRow(): void {
    this.itemsArray.push(this.buildRow());
    this.rowStates.push({
      search: '',
      selectedName: '',
      filtered: this.products(),
      showDropdown: false,
    });
  }

  /**
   *  Permite eliminar una fila de producto del formulario, asegurándose de que siempre quede al menos una fila disponible para ingresar datos.
   * @param index
   * @returns
   */
  removeRow(index: number): void {
    if (this.itemsArray.length === 1) return;
    this.itemsArray.removeAt(index);
    this.rowStates.splice(index, 1);
  }

  /**
   *  Método para manejar la búsqueda de productos dentro de una fila específica, actualizando el estado de búsqueda y el listado filtrado de productos para mostrar en el dropdown.
   * @param index
   * @param value
   */
  onRowProductSearch(index: number, value: string): void {
    const state = this.rowStates[index];
    state.search = value;
    state.filtered = this.products().filter((p) =>
      p.name.toLowerCase().includes(value.toLowerCase()),
    );
    state.showDropdown = true;
    if (!value) {
      this.itemsArray.at(index).patchValue({ productId: '' });
      state.selectedName = '';
    }
  }

  /**
   *  Permite seleccionar un producto del dropdown para una fila específica, actualizando el formulario con el ID del producto seleccionado y cerrando el dropdown.
   * @param index
   * @param product
   */
  selectRowProduct(index: number, product: Product): void {
    this.itemsArray.at(index).patchValue({ productId: product.id });
    const state = this.rowStates[index];
    state.selectedName = product.name;
    state.search = product.name;
    state.showDropdown = false;
  }

  /**
   * Permite limpiar la selección de producto para una fila específica, reseteando el campo del formulario y el estado de búsqueda y filtrado para esa fila.
   * @param index
   */
  clearRowProduct(index: number): void {
    this.itemsArray.at(index).patchValue({ productId: '' });
    const state = this.rowStates[index];
    state.selectedName = '';
    state.search = '';
    state.filtered = this.products();
  }

  /**
   * Maneja la búsqueda de consumidores (profesores o empleados) según el tipo seleccionado, actualizando el estado de búsqueda y el listado filtrado para mostrar en el dropdown de selección de consumidor.
   * @param value
   */
  onConsumerSearch(value: string): void {
    this.consumerSearch.set(value);
    const lower = value.toLowerCase();
    if (this.isTeacher) {
      this.filteredTeachers.set(
        this.teachers().filter((t) => t.fullName.toLowerCase().includes(lower)),
      );
    } else {
      this.filteredUsers.set(
        this.users().filter((u) => u.fullName.toLowerCase().includes(lower)),
      );
    }
    this.showConsumerDropdown.set(true);
    if (!value) {
      this.form.patchValue({ teacherId: null, userId: null });
      this.selectedConsumerName.set('');
    }
  }

  /**
   *  Permite seleccionar un profesor del dropdown, actualizando el formulario con el ID del profesor seleccionado y cerrando el dropdown de consumidores.
   * @param teacher
   */
  selectTeacher(teacher: Teacher): void {
    this.form.patchValue({ teacherId: teacher.id, userId: null });
    this.selectedConsumerName.set(teacher.fullName);
    this.consumerSearch.set(teacher.fullName);
    this.showConsumerDropdown.set(false);
  }

  /**
   *  Permite seleccionar un empleado del dropdown, actualizando el formulario con el ID del empleado seleccionado y cerrando el dropdown de consumidores.
   * @param user
   */
  selectUser(user: User): void {
    this.form.patchValue({ userId: user.id, teacherId: null });
    this.selectedConsumerName.set(user.fullName);
    this.consumerSearch.set(user.fullName);
    this.showConsumerDropdown.set(false);
  }

  /**
   * Permite limpiar la selección de consumidor, reseteando los campos del formulario relacionados con el consumidor y el estado de búsqueda y filtrado para los consumidores.
   */
  clearConsumer(): void {
    this.form.patchValue({ teacherId: null, userId: null });
    this.consumerSearch.set('');
    this.selectedConsumerName.set('');
    this.filteredTeachers.set(this.teachers());
    this.filteredUsers.set(this.users());
  }

  /**
   *  Maneja el envío del formulario, validando que se haya seleccionado un consumidor y al menos un producto válido, y luego realiza las llamadas al servicio para crear los consumos internos correspondientes. También maneja la generación de la URL de WhatsApp para notificar al profesor si el consumidor es un docente.
   */
  onSubmit(): void {
    const { consumerType, userId, teacherId, notes, date } =
      this.form.getRawValue();

    if (consumerType === 'teacher' && !teacherId) {
      this.serverError.set('Seleccioná un profesor.');
      return;
    }
    if (consumerType === 'staff' && !userId) {
      this.serverError.set('Seleccioná un empleado.');
      return;
    }
    if (this.itemsArray.invalid) {
      this.itemsArray.markAllAsTouched();
      this.serverError.set('Completá todos los productos y cantidades.');
      return;
    }

    this.submitting.set(true);
    this.serverError.set(null);

    const requests = this.itemsArray.controls.map((ctrl) => {
      const { productId, quantity } = ctrl.getRawValue();
      return this.service.create({
        consumerType,
        productId,
        quantity,
        userId: userId ?? undefined,
        teacherId: teacherId ?? undefined,
        notes: notes || undefined,
        date,
      });
    });

    forkJoin(requests).subscribe({
      next: () => {
        this.submitting.set(false);
        this.productsService.clearCache();
        this.productsService.findAll().subscribe((products) => {
          this.products.set(products.filter((p) => p.isActive && p.stock > 0));
          this.rowStates.forEach((s) => (s.filtered = this.products()));
        });

        if (consumerType === 'teacher' && teacherId) {
          const teacher = this.teachers().find((t) => t.id === teacherId);
          if (teacher?.phoneNumber) {
            const items = this.itemsArray.controls.map((ctrl) => {
              const { productId, quantity } = ctrl.getRawValue();
              const product = this.products().find((p) => p.id === productId);
              const subtotal = (product?.salePrice ?? 0) * quantity;
              return { name: product?.name ?? productId, quantity, subtotal };
            });
            const total = items.reduce((sum, i) => sum + i.subtotal, 0);
            this.whatsAppUrl.set(
              this.service.buildItemizedWhatsAppUrl(
                teacher.phoneNumber,
                teacher.fullName,
                items,
                total,
              ),
            );
            this.savedTeacherName.set(teacher.fullName);
            this.showWhatsAppPrompt.set(true);
            return;
          }
        }

        this.saved.emit();
      },
      error: (err) => {
        this.submitting.set(false);
        this.serverError.set(
          err?.error?.message ?? 'Ocurrió un error. Intente de nuevo.',
        );
      },
    });
  }

  /**
   *  Maneja la confirmación del envío del mensaje de WhatsApp, abriendo la URL generada en una nueva pestaña si el usuario confirma, y luego emitiendo el evento de guardado para cerrar el formulario.
   * @param send
   */
  confirmWhatsApp(send: boolean): void {
    if (send) {
      window.open(this.whatsAppUrl(), '_blank', 'noopener,noreferrer');
    }
    this.showWhatsAppPrompt.set(false);
    this.saved.emit();
  }

  /**
   * Maneja la cancelación del formulario, emitiendo el evento de cancelación para cerrar el formulario sin guardar cambios.
   */
  onCancel(): void {
    this.cancelled.emit();
  }

  /**
   * Permite cerrar todos los dropdowns abiertos (tanto de productos como de consumidores) al hacer clic fuera de ellos, asegurándose de que no queden dropdowns abiertos accidentalmente.
   */
  closeDropdowns(): void {
    this.rowStates.forEach((s) => (s.showDropdown = false));
    this.showConsumerDropdown.set(false);
  }

  /**
   *  Permite verificar si una fila específica tiene un error de validación en un campo determinado, para mostrar mensajes de error o estilos de validación en la plantilla.
   * @param index
   * @param field
   * @param error
   * @returns
   */
  rowHasError(index: number, field: string, error: string): boolean {
    const ctrl = this.itemsArray.at(index).get(field);
    return !!(ctrl?.touched && ctrl.hasError(error));
  }
}
