import { TestBed } from '@angular/core/testing';
import { DraftService } from './draft.service';

describe('DraftService', () => {
  let service: DraftService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DraftService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('saveDraft() persists serialized data under the given key', () => {
    service.saveDraft('draft-key', { foo: 'bar', n: 1 });
    expect(localStorage.getItem('draft-key')).toBe(
      JSON.stringify({ foo: 'bar', n: 1 }),
    );
  });

  it('getDraft() returns the deserialized value', () => {
    service.saveDraft('draft-key', { foo: 'bar' });
    expect(service.getDraft<{ foo: string }>('draft-key')).toEqual({
      foo: 'bar',
    });
  });

  it('getDraft() returns null when nothing is stored', () => {
    expect(service.getDraft('missing-key')).toBeNull();
  });

  it('getDraft() returns null and does not throw on malformed JSON', () => {
    localStorage.setItem('draft-key', '{not valid json');
    expect(service.getDraft('draft-key')).toBeNull();
  });

  it('clearDraft() removes the stored value', () => {
    service.saveDraft('draft-key', { foo: 'bar' });
    service.clearDraft('draft-key');
    expect(localStorage.getItem('draft-key')).toBeNull();
  });

  it('hasDraft() reflects whether a key is present', () => {
    expect(service.hasDraft('draft-key')).toBe(false);
    service.saveDraft('draft-key', { foo: 'bar' });
    expect(service.hasDraft('draft-key')).toBe(true);
  });
});
