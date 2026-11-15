import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TicketModalComponent } from './ticket-modal.component';
import { SalesService, SaleDetail } from '../../core/services/sales.service';

describe('TicketModalComponent', () => {
  let salesServiceSpy: jasmine.SpyObj<SalesService>;

  const mockSale: SaleDetail = {
    id: 's1',
    total: '1500',
    amountCash: '1500',
    amountTransfer: '0',
    customerName: null,
    createdAt: '2026-01-01T10:00:00Z',
    items: [],
  };

  beforeEach(async () => {
    salesServiceSpy = jasmine.createSpyObj('SalesService', ['findOne']);

    await TestBed.configureTestingModule({
    imports: [TicketModalComponent],
    providers: [{ provide: SalesService, useValue: salesServiceSpy }],
}).compileComponents();
  });

  it('creates without a saleId', () => {
    const fixture = TestBed.createComponent(TicketModalComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance.sale()).toBeNull();
  });

  it('fetches the sale when saleId is set', () => {
    salesServiceSpy.findOne.and.returnValue(of(mockSale));
    const fixture = TestBed.createComponent(TicketModalComponent);
    fixture.detectChanges();

    fixture.componentRef.setInput('saleId', 's1');
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(salesServiceSpy.findOne).toHaveBeenCalledWith('s1');
    expect(fixture.componentInstance.sale()).toEqual(mockSale);
    expect(fixture.componentInstance.isLoading()).toBe(false);
  });

  it('sets loadError when the fetch fails', () => {
    salesServiceSpy.findOne.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(TicketModalComponent);
    fixture.detectChanges();

    fixture.componentRef.setInput('saleId', 's1');
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(fixture.componentInstance.loadError()).toContain('No se pudo cargar');
  });

  it('clears the sale when saleId becomes null', () => {
    salesServiceSpy.findOne.and.returnValue(of(mockSale));
    const fixture = TestBed.createComponent(TicketModalComponent);
    fixture.detectChanges();

    fixture.componentRef.setInput('saleId', 's1');
    fixture.detectChanges();
    TestBed.flushEffects();

    fixture.componentRef.setInput('saleId', null);
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(fixture.componentInstance.sale()).toBeNull();
  });

  it('fetches exactly once per saleId change and ignores its own state signals', () => {
    salesServiceSpy.findOne.and.returnValue(of(mockSale));
    const fixture = TestBed.createComponent(TicketModalComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('saleId', 's1');
    fixture.detectChanges();
    TestBed.flushEffects();
    expect(salesServiceSpy.findOne).toHaveBeenCalledTimes(1);

    // State written by the load must not re-run the effect.
    component.sale.set(null);
    component.isLoading.set(true);
    component.loadError.set('x');
    fixture.detectChanges();
    TestBed.flushEffects();
    expect(salesServiceSpy.findOne).toHaveBeenCalledTimes(1);

    // Re-setting the same saleId is not a change.
    fixture.componentRef.setInput('saleId', 's1');
    fixture.detectChanges();
    TestBed.flushEffects();
    expect(salesServiceSpy.findOne).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('saleId', 's2');
    fixture.detectChanges();
    TestBed.flushEffects();
    expect(salesServiceSpy.findOne.calls.allArgs()).toEqual([['s1'], ['s2']]);
  });

  it('resets sale and loadError when saleId becomes null after a failed fetch', () => {
    salesServiceSpy.findOne.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(TicketModalComponent);
    fixture.componentRef.setInput('saleId', 's1');
    fixture.detectChanges();
    TestBed.flushEffects();
    expect(fixture.componentInstance.loadError()).toBe('No se pudo cargar el detalle de la venta.');
    expect(fixture.componentInstance.isLoading()).toBe(false);

    fixture.componentRef.setInput('saleId', null);
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(fixture.componentInstance.sale()).toBeNull();
    expect(fixture.componentInstance.loadError()).toBe('');
    expect(fixture.componentInstance.isLoading()).toBe(false);
    expect(salesServiceSpy.findOne).toHaveBeenCalledTimes(1);
  });

  it('close() emits closeModal', () => {
    const fixture = TestBed.createComponent(TicketModalComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const emitSpy = spyOn(component.closeModal, 'emit');
    component.close();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('fmt() formats numbers and numeric strings with the AR locale', () => {
    const fixture = TestBed.createComponent(TicketModalComponent);
    expect(fixture.componentInstance.fmt('1500')).toBe((1500).toLocaleString('es-AR'));
  });

  it('itemSubtotal() multiplies unit price by quantity', () => {
    const fixture = TestBed.createComponent(TicketModalComponent);
    expect(fixture.componentInstance.itemSubtotal('500', 3)).toBe(1500);
  });

  it('formatFechaHora() returns placeholders for an empty string', () => {
    const fixture = TestBed.createComponent(TicketModalComponent);
    expect(fixture.componentInstance.formatFechaHora('')).toEqual({
      fecha: '--',
      hora: '--',
    });
  });

  it('renders nothing without a saleId and one row per item once the sale loads', () => {
    salesServiceSpy.findOne.and.returnValue(
      of({
        ...mockSale,
        customerName: 'Juan',
        items: [
          { quantity: 2, unitPrice: '500', product: { name: 'Gatorade' } },
          { quantity: 1, unitPrice: '500', product: { name: 'Pelotas' } },
        ],
      } as any),
    );
    const fixture = TestBed.createComponent(TicketModalComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent?.trim()).toBe('');

    fixture.componentRef.setInput('saleId', 's1');
    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Gatorade');
    expect(el.textContent).toContain('Cliente: Juan');
    expect(el.textContent).toContain('Efectivo');
    expect(el.textContent).not.toContain('Transferencia');
  });

  it('renders the load error message when the fetch fails', () => {
    salesServiceSpy.findOne.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(TicketModalComponent);
    fixture.componentRef.setInput('saleId', 's1');
    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No se pudo cargar el detalle de la venta.');
  });
});
