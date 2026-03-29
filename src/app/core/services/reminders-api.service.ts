import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ReminderItem {
  bookingId: string;
  clientName: string;
  phoneNumber: string | null;
  courtName: string;
  date: string;
  hour: string;
}

export interface UpcomingReminders {
  today: ReminderItem[];
  tomorrow: ReminderItem[];
}

@Injectable({ providedIn: 'root' })
export class RemindersApiService {
  private readonly url = `${environment.apiUrl}/reminders/upcoming`;

  constructor(private http: HttpClient) {}

  getUpcoming(): Observable<UpcomingReminders> {
    return this.http.get<UpcomingReminders>(this.url);
  }
}
