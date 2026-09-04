import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
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
    schemas: [NO_ERRORS_SCHEMA],
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
});
