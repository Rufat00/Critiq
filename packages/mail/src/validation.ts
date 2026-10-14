import { MailError } from './types.ts';

export function text(value: string, field: string, max = 200): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[\x00-\x1f\x7f]/.test(value)
  ) {
    throw new MailError('INVALID_INPUT', `${field} is invalid.`);
  }
  return value.trim();
}

export function email(value: string, field: string): string {
  const address = text(value, field, 254);
  if (
    !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(
      address,
    )
  ) {
    throw new MailError(
      'INVALID_INPUT',
      `${field} must be a single email address.`,
    );
  }
  return address;
}

export function url(value: string, field: string, production: boolean): string {
  try {
    const parsed = new URL(text(value, field, 4096));
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (
      parsed.username ||
      parsed.password ||
      (parsed.protocol !== 'https:' &&
        !(parsed.protocol === 'http:' && local && !production))
    )
      throw new Error();
    return parsed.href;
  } catch {
    throw new MailError(
      'INVALID_INPUT',
      `${field} must be an HTTPS URL (local HTTP is allowed in development).`,
    );
  }
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  );
}
