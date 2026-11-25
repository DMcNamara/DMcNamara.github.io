import type { Resume } from '../../src/lib/resume-schema';

/**
 * Carries over fields the Doc may not have. If the new extraction has no
 * basics.summary (the Website tab has no summary paragraph), keep the one already
 * in resume.json, so the home page's About paragraph isn't wiped by a sync.
 * A summary in the Doc always wins.
 */
export function keepExistingSummary(next: Resume, previous: unknown): Resume {
  if (next.basics.summary) return next;
  const summary = (previous as { basics?: { summary?: unknown } } | null)?.basics?.summary;
  if (typeof summary !== 'string' || !summary.trim()) return next;
  return { ...next, basics: { ...next.basics, summary } };
}
