import raw from '../data/resume.json';
import { resumeSchema, type Resume, type Work } from './resume-schema';
import { assertNoPII } from './pii';

// Validate at build time: bad data or stray contact details fail the build.
export const resume: Resume = resumeSchema.parse(raw);
assertNoPII(resume);

export interface Company {
  name: string;
  location?: string;
  startDate: string;
  endDate?: string;
  roles: Work[];
}

/** Groups consecutive roles at the same company (e.g. two titles at Solstice). */
export function groupByCompany(work: Work[]): Company[] {
  const out: Company[] = [];
  for (const role of work) {
    const last = out.at(-1);
    if (last && last.name === role.name) {
      last.roles.push(role);
      last.startDate = role.startDate; // roles are listed newest first
    } else {
      out.push({
        name: role.name,
        location: role.location,
        startDate: role.startDate,
        endDate: role.endDate,
        roles: [role],
      });
    }
  }
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(iso?: string): string {
  if (!iso) return 'Present';
  const [y, m] = iso.split('-');
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : y;
}

export function formatRange(start: string, end?: string): string {
  return `${formatDate(start)} – ${formatDate(end)}`;
}
