import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { InternalConsumptionFormComponent } from './internal-consumption-form.component';
import { AuthService } from '../../../core/services/auth.service';
import { InternalConsumptionService } from '../../../core/services/internal-consumption.service';
import { ProductsService } from '../../../core/services/products.service';
import { TeachersService } from '../../../core/services/teachers.service';
import { UsersService } from '../../../core/services/users.service';
import { Product } from '../../../core/models/product.model';
import { Teacher } from '../../../core/models/teacher.model';
import { User } from '../../../core/models/user.model';

describe('InternalConsumptionFormComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let serviceSpy: jasmine.SpyObj<InternalConsumptionService>;
  let productsServiceSpy: jasmine.SpyObj<ProductsService>;
  let teachersServiceSpy: jasmine.SpyObj<TeachersService>;
  let usersServiceSpy: jasmine.SpyObj<UsersService>;

  const product: Product = {
    id: 'p1',
    name: 'Gatorade',
    costPrice: 500,
    salePrice: 800,
    stock: 10,
    minStock: 2,
    isFeatured: false,
    isActive: true,
  };
  const teacher: Teacher = {
    id: 't1',
    fullName: 'Juan',
    phoneNumber: null,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };
  const user: User = {
    id: 'u1',
    username: 'empleado',
    fullName: 'Empleado',
    role: 'employee',
    isActive: true,
    createdAt: '',
  };

  function setup(role: 'admin' | 'employee') {
    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      currentUser: { id: 'u1', role },
    });
    serviceSpy = jasmine.createSpyObj('InternalConsumptionService', [
      'create',
      'buildItemizedWhatsAppUrl',
    ]);
    productsServiceSpy = jasmine.createSpyObj('ProductsService', ['findAll', 'clearCache']);
    teachersServiceSpy = jasmine.createSpyObj('TeachersService', ['findAll']);
    usersServiceSpy = jasmine.createSpyObj('UsersService', ['findAll']);

    productsServiceSpy.findAll.and.returnValue(of([product]));
    teachersServiceSpy.findAll.and.returnValue(of([teacher]));
    usersServiceSpy.findAll.and.returnValue(of([user]));

    TestBed.configureTestingModule({
      declarations: [InternalConsumptionFormComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InternalConsumptionService, useValue: serviceSpy },
        { provide: ProductsService, useValue: productsServiceSpy },
        { provide: TeachersService, useValue: teachersServiceSpy },
        { provide: UsersService, useValue: usersServiceSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
  }

  it('defaults consumerType to "staff" for employees and "teacher" for admins', () => {
    setup('employee');
    const fixture = TestBed.createComponent(InternalConsumptionFormComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.form.value.consumerType).toBe('staff');
  });

  it('loads products, teachers and users (employees skip the users call)', () => {
    setup('employee');
    const fixture = TestBed.createComponent(InternalConsumptionFormComponent);
    fixture.detectChanges();

    expect(usersServiceSpy.findAll).not.toHaveBeenCalled();
    expect(fixture.componentInstance.products).toEqual([product]);
    expect(fixture.componentInstance.loadingData).toBe(false);
    expect(fixture.componentInstance.itemsArray.length).toBe(1);
  });

  it('admins load the full active users list', () => {
    setup('admin');
    const fixture = TestBed.createComponent(InternalConsumptionFormComponent);
    fixture.detectChanges();
    expect(usersServiceSpy.findAll).toHaveBeenCalled();
  });

  it('sets a server error when the initial parallel load fails', () => {
    setup('admin');
    productsServiceSpy.findAll.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(InternalConsumptionFormComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.serverError).toContain('No se pudieron cargar');
  });

  it('canSubmit requires a consumer and at least one product', () => {
    setup('admin');
    const fixture = TestBed.createComponent(InternalConsumptionFormComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.canSubmit).toBe(false);

    fixture.componentInstance.selectTeacher(teacher);
    expect(fixture.componentInstance.canSubmit).toBe(false);

    fixture.componentInstance.selectRowProduct(0, product);
    expect(fixture.componentInstance.canSubmit).toBe(true);
  });

  it('addRow()/removeRow() manage the items FormArray, keeping at least one row', () => {
    setup('admin');
    const fixture = TestBed.createComponent(InternalConsumptionFormComponent);
    fixture.detectChanges();
    fixture.componentInstance.addRow();
    expect(fixture.componentInstance.itemsArray.length).toBe(2);
    fixture.componentInstance.removeRow(0);
    expect(fixture.componentInstance.itemsArray.length).toBe(1);
    fixture.componentInstance.removeRow(0);
    expect(fixture.componentInstance.itemsArray.length).toBe(1);
  });

  it('onSubmit() requires a teacher when consumerType is teacher', () => {
    setup('admin');
    const fixture = TestBed.createComponent(InternalConsumptionFormComponent);
    fixture.detectChanges();
    fixture.componentInstance.selectRowProduct(0, product);

    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.serverError).toContain('Seleccioná un profesor');
    expect(serviceSpy.create).not.toHaveBeenCalled();
  });

  it('onSubmit() creates a consumption per item row and emits saved', () => {
    setup('admin');
    serviceSpy.create.and.returnValue(of({} as any));
    productsServiceSpy.findAll.and.returnValue(of([product]));
    const fixture = TestBed.createComponent(InternalConsumptionFormComponent);
    fixture.detectChanges();
    fixture.componentInstance.selectTeacher({ ...teacher, phoneNumber: null });
    fixture.componentInstance.selectRowProduct(0, product);
    const emitSpy = spyOn(fixture.componentInstance.saved, 'emit');

    fixture.componentInstance.onSubmit();

    expect(serviceSpy.create).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('onSubmit() prompts WhatsApp confirmation when the teacher has a phone number', () => {
    setup('admin');
    serviceSpy.create.and.returnValue(of({} as any));
    serviceSpy.buildItemizedWhatsAppUrl.and.returnValue('https://wa.me/123');
    productsServiceSpy.findAll.and.returnValue(of([product]));
    teachersServiceSpy.findAll.and.returnValue(of([{ ...teacher, phoneNumber: '1122334455' }]));
    const fixture = TestBed.createComponent(InternalConsumptionFormComponent);
    fixture.detectChanges();
    fixture.componentInstance.selectTeacher({ ...teacher, phoneNumber: '1122334455' });
    fixture.componentInstance.selectRowProduct(0, product);
    const emitSpy = spyOn(fixture.componentInstance.saved, 'emit');

    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.showWhatsAppPrompt).toBe(true);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('confirmWhatsApp(true) opens the URL and emits saved', () => {
    setup('admin');
    const windowOpenSpy = spyOn(window, 'open');
    const fixture = TestBed.createComponent(InternalConsumptionFormComponent);
    fixture.detectChanges();
    fixture.componentInstance.whatsAppUrl = 'https://wa.me/123';
    const emitSpy = spyOn(fixture.componentInstance.saved, 'emit');

    fixture.componentInstance.confirmWhatsApp(true);

    expect(windowOpenSpy).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('onCancel() emits cancelled', () => {
    setup('admin');
    const fixture = TestBed.createComponent(InternalConsumptionFormComponent);
    fixture.detectChanges();
    const emitSpy = spyOn(fixture.componentInstance.cancelled, 'emit');
    fixture.componentInstance.onCancel();
    expect(emitSpy).toHaveBeenCalled();
  });
});
