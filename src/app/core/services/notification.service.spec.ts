import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { AppNotification } from '../models/notification.model';

const STORAGE_KEY = 'caldera_notifications';

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    entityId: 'booking-1',
    title: 'Turno demorado',
    message: 'El turno de las 10:00 lleva 15 min de retraso.',
    category: 'TURNOS',
    actionRoute: ['/app/schedule'],
    createdAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

describe('NotificationService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts empty when nothing is persisted', () => {
    const service = TestBed.inject(NotificationService);
    expect(service.count).toBe(0);
  });

  it('loads persisted notifications on construction, restoring createdAt as Date', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([makeNotification()]));
    const service = TestBed.inject(NotificationService);
    expect(service.count).toBe(1);
    expect(service['_notifications$'].value[0].createdAt instanceof Date).toBe(true);
  });

  it('returns empty list and does not throw on malformed persisted JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid');
    const service = TestBed.inject(NotificationService);
    expect(service.count).toBe(0);
  });

  it('add() prepends a notification and persists it', () => {
    const service = TestBed.inject(NotificationService);
    service.add(makeNotification({ id: 'n1' }));
    service.add(makeNotification({ id: 'n2' }));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(service.count).toBe(2);
    expect(service['_notifications$'].value[0].id).toBe('n2');
    expect(stored.length).toBe(2);
  });

  it('add() ignores a notification with a duplicate id', () => {
    const service = TestBed.inject(NotificationService);
    service.add(makeNotification({ id: 'n1' }));
    service.add(makeNotification({ id: 'n1' }));
    expect(service.count).toBe(1);
  });

  it('removeById() removes only the matching notification', () => {
    const service = TestBed.inject(NotificationService);
    service.add(makeNotification({ id: 'n1' }));
    service.add(makeNotification({ id: 'n2' }));
    service.removeById('n1');
    expect(service.count).toBe(1);
    expect(service['_notifications$'].value[0].id).toBe('n2');
  });

  it('removeByEntityId() removes all notifications for that entity', () => {
    const service = TestBed.inject(NotificationService);
    service.add(makeNotification({ id: 'n1', entityId: 'booking-1' }));
    service.add(makeNotification({ id: 'n2', entityId: 'booking-1' }));
    service.add(makeNotification({ id: 'n3', entityId: 'booking-2' }));
    service.removeByEntityId('booking-1');
    expect(service.count).toBe(1);
    expect(service['_notifications$'].value[0].id).toBe('n3');
  });

  it('clearAllNotifications() empties the list and storage', () => {
    const service = TestBed.inject(NotificationService);
    service.add(makeNotification());
    service.clearAllNotifications();
    expect(service.count).toBe(0);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([]);
  });
});
