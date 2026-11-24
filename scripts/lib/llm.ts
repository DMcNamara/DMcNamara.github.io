import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { resumeSchema, type Resume } from '../../src/lib/resume-schema';

const PROMPT = `You convert a resume, given as plain text, into JSON that matches the provided schema (a subset of the JSON Resume schema).

Rules:
- Use only information that appears in the text. Never invent roles, dates, metrics or links.
- Keep bullet wording as written; fix only obvious typos and add a final period.
- List work entries newest first. A company with two titles is two work entries with the same "name".
- Dates are "YYYY-MM" ("September 2020" -> "2020-09"). Omit endDate when the role says "Present".
- Put a note like "Solstice merged with Perch in February 2026" in that role's "summary", not in "highlights".
- Do not output email addresses, phone numbers or street addresses anywhere.
- "profiles" come from link URLs in the header (LinkedIn, GitHub, etc.). Interests may carry a url if one is linked.
- If the resume has no summary paragraph, omit basics.summary.

Resume text:
`;

/**
 * Gemini's responseJsonSchema accepts a subset of JSON Schema, so drop
 * keywords it rejects. Zod re-validates the output strictly afterwards.
 */
function geminiSchema(): unknown {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === '$schema' || k === 'additionalProperties' || k === 'pattern' || k === 'format') continue;
        out[k] = strip(v);
      }
      return out;
    }
    return node;
  };
  return strip(z.toJSONSchema(resumeSchema, { io: 'input' }));
}

export async function extractResume(text: string): Promise<Resume> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  // Model names change often; set GEMINI_MODEL in the workflow to pin one.
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';

  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model,
    contents: PROMPT + text,
    config: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseJsonSchema: geminiSchema(),
    },
  });

  const raw = res.text;
  if (!raw) throw new Error(`Empty response from ${model}`);

  const parsed = resumeSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Model output failed validation:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
