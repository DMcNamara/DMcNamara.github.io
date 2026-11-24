/**
 * Deterministic PII scrubbing. Runs after the LLM step in the sync script and
 * again at build time, so a phone number or email can't reach the public site
 * even if the model ignores its instructions.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// North American numbers in common formats: (484) 269-9114, 484.269.9114, +1 484 269 9114
const PHONE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

const BLOCKED_KEYS = new Set(['email', 'phone', 'address', 'postalCode', 'references']);

/** Returns a deep copy with blocked keys removed and email/phone patterns stripped from strings. */
export function scrubPII<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(EMAIL, '').replace(PHONE, '').replace(/\s{2,}/g, ' ').trim() as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => scrubPII(v)).filter((v) => v !== '') as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (BLOCKED_KEYS.has(k)) continue;
      out[k] = scrubPII(v);
    }
    return out as T;
  }
  return value;
}

/** Lists every string path that still looks like an email or phone number. */
export function findPII(value: unknown, path = '$'): string[] {
  if (typeof value === 'string') {
    // Reset lastIndex: these regexes are global.
    EMAIL.lastIndex = 0;
    PHONE.lastIndex = 0;
    return EMAIL.test(value) || PHONE.test(value) ? [path] : [];
  }
  if (Array.isArray(value)) return value.flatMap((v, i) => findPII(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      BLOCKED_KEYS.has(k) ? [`${path}.${k}`] : findPII(v, `${path}.${k}`),
    );
  }
  return [];
}

export function assertNoPII(value: unknown): void {
  const hits = findPII(value);
  if (hits.length) {
    throw new Error(`Resume data contains contact details at: ${hits.join(', ')}`);
  }
}
