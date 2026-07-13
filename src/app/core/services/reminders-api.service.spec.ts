import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RemindersApiService, UpcomingReminders } from './reminders-api.service';
import { environment } from '../../../environments/environment';

describe('RemindersApiService', () => {
  let service: RemindersApiService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/reminders/upcoming`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(RemindersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getUpcoming() issues a GET to /reminders/upcoming and returns the body', (done) => {
    const mockResponse: UpcomingReminders = {
      today: [
        {
          bookingId: 'b1',
          clientName: 'Juan',
          phoneNumber: null,
          courtName: 'Cancha 1',
          date: '2026-01-01',
          hour: '10:00',
        },
      ],
      tomorrow: [],
    };

    service.getUpcoming().subscribe((res) => {
      expect(res).toEqual(mockResponse);
      done();
    });

    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
});
