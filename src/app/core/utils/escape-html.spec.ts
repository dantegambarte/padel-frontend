import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<img src="x" onerror='a'>&`)).toBe(
      '&#60;img src=&#34;x&#34; onerror=&#39;a&#39;&#62;&#38;',
    );
  });

  it('renders null and undefined as empty and numbers as text', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(3)).toBe('3');
  });
});
