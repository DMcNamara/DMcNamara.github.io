import { z } from 'zod';

/**
 * A subset of the JSON Resume schema (https://jsonresume.org/schema).
 * Shared by the sync script (validates LLM output) and the site build
 * (fails the build on bad data). Contact fields like email/phone are
 * deliberately absent: the public site never carries them.
 */

// JSON Resume uses partial ISO-8601 dates: "2014", "2014-06", "2014-06-01".
const isoDate = z
  .string()
  .regex(/^\d{4}(-\d{2}){0,2}$/, 'Expected YYYY, YYYY-MM or YYYY-MM-DD');

const profile = z.object({
  network: z.string(),
  username: z.string().optional(),
  url: z.url(),
});

const work = z.object({
  name: z.string().describe('Company name'),
  location: z.string().optional().describe('City, state or "Remote"'),
  position: z.string(),
  startDate: isoDate,
  endDate: isoDate.optional().describe('Omit when the role is current ("Present")'),
  summary: z.string().optional(),
  highlights: z.array(z.string()).default([]),
});

const education = z.object({
  institution: z.string(),
  location: z.string().optional(),
  area: z.string().describe('Field of study'),
  studyType: z.string().describe('e.g. "Bachelor of Science"'),
  endDate: isoDate.optional(),
  score: z.string().optional().describe('Honors, e.g. "summa cum laude"'),
  courses: z.array(z.string()).optional().describe('Minors or notable coursework'),
});

const project = z.object({
  name: z.string(),
  description: z.string(),
  startDate: isoDate.optional(),
  url: z.url().optional(),
  keywords: z.array(z.string()).optional(),
});

const skill = z.object({
  name: z.string().describe('Category, e.g. "Programming"'),
  keywords: z.array(z.string()),
});

const interest = z.object({
  name: z.string(),
  url: z.url().optional(),
});

export const resumeSchema = z.object({
  basics: z.object({
    name: z.string(),
    label: z.string().describe('Headline under the name'),
    summary: z.string().optional(),
    location: z
      .object({ city: z.string().optional(), region: z.string().optional() })
      .optional(),
    profiles: z.array(profile).default([]),
  }),
  work: z.array(work).min(1),
  education: z.array(education).default([]),
  projects: z.array(project).default([]),
  skills: z.array(skill).default([]),
  interests: z.array(interest).default([]),
});

export type Resume = z.infer<typeof resumeSchema>;
export type Work = z.infer<typeof work>;
