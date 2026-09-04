import { TestBed } from '@angular/core/testing';
import { CalculatorService } from './calculator.service';

describe('CalculatorService', () => {
  let service: CalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CalculatorService);
  });

  it('starts closed', (done) => {
    service.visible$.subscribe((v) => {
      expect(v).toBe(false);
      done();
    });
  });

  it('open() sets visible$ to true', (done) => {
    service.open();
    service.visible$.subscribe((v) => {
      expect(v).toBe(true);
      done();
    });
  });

  it('close() sets visible$ to false', (done) => {
    service.open();
    service.close();
    service.visible$.subscribe((v) => {
      expect(v).toBe(false);
      done();
    });
  });

  it('toggle() flips the current value each call', () => {
    expect(service['_visible$'].value).toBe(false);
    service.toggle();
    expect(service['_visible$'].value).toBe(true);
    service.toggle();
    expect(service['_visible$'].value).toBe(false);
  });
});
