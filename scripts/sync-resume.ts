/**
 * Google Doc tab -> plain text -> Gemini (structured output) -> Zod -> PII scrub -> src/data/resume.json
 *
 * Usage:
 *   npm run sync:resume               # writes src/data/resume.json
 *   npm run sync:resume -- --dry-run  # prints the flattened text and JSON, writes nothing
 *
 * Env: RESUME_DOC_ID, RESUME_TAB_ID, GEMINI_API_KEY, optional GEMINI_MODEL,
 * plus Google credentials (see README).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchTabText } from './lib/docs';
import { extractResume } from './lib/llm';
import { keepExistingSummary } from './lib/merge';
import { scrubPII, assertNoPII } from '../src/lib/pii';
import { resumeSchema } from '../src/lib/resume-schema';

const OUT = fileURLToPath(new URL('../src/data/resume.json', import.meta.url));
const dryRun = process.argv.includes('--dry-run');

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function main() {
  const docId = required('RESUME_DOC_ID');
  const tabId = required('RESUME_TAB_ID');

  console.log(`Fetching tab ${tabId}…`);
  const text = await fetchTabText(docId, tabId);
  console.log(`Got ${text.split('\n').length} lines of text.`);
  if (dryRun) console.log(`\n----- flattened text -----\n${text}\n--------------------------\n`);

  console.log('Extracting structured resume…');
  const extracted = await extractResume(text);

  const previous = await readFile(OUT, 'utf8').catch(() => '');
  let previousData: unknown = null;
  try {
    previousData = JSON.parse(previous);
  } catch {
    // Missing or unreadable file: nothing to carry over.
  }

  // Deterministic scrub after the LLM step, then re-validate and double-check.
  // The kept summary goes through the same scrub and PII check as the new data.
  const extractedResume = resumeSchema.parse(scrubPII(extracted));
  const resume = resumeSchema.parse(scrubPII(keepExistingSummary(extractedResume, previousData)));
  if (!extractedResume.basics.summary && resume.basics.summary) {
    console.log('No summary in the Doc; keeping the existing basics.summary.');
  }
  assertNoPII(resume);

  const json = JSON.stringify(resume, null, 2) + '\n';
  if (dryRun) {
    console.log(json);
    return;
  }

  if (previous === json) {
    console.log('No changes.');
    return;
  }
  await writeFile(OUT, json);
  console.log(`Wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
