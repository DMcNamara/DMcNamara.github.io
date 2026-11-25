import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { flatten, findTab } from './docs';
import { keepExistingSummary } from './merge';
import { scrubPII, findPII } from '../../src/lib/pii';
import { resumeSchema } from '../../src/lib/resume-schema';

test('scrubPII removes contact fields and patterns', () => {
  const dirty = {
    basics: { name: 'Dan', email: 'x@y.com', phone: '(484) 269-9114', label: 'Call 484.269.9114 or mail dmc@example.org' },
    work: [{ highlights: ['Grew team from 4 to 12 between 2014-2016', 'dmc@example.org'] }],
  };
  const clean = scrubPII(dirty);
  assert.deepEqual(findPII(clean), []);
  assert.equal('email' in clean.basics, false);
  assert.equal(clean.basics.label, 'Call or mail');
  // Non-PII numbers survive; strings that become empty are dropped.
  assert.deepEqual(clean.work[0].highlights, ['Grew team from 4 to 12 between 2014-2016']);
});

test('findTab searches nested child tabs', () => {
  const tabs = [
    { tabProperties: { tabId: 't.0' }, childTabs: [{ tabProperties: { tabId: 't.child' } }] },
  ];
  assert.equal(findTab(tabs, 't.child')?.tabProperties?.tabId, 't.child');
  assert.equal(findTab(tabs, 't.missing'), undefined);
});

test('flatten joins single-line table cells and keeps bullets and links', () => {
  const p = (content: string, extra: object = {}) => ({
    paragraph: { elements: [{ textRun: { content, ...extra } }] },
  });
  const text = flatten([
    p('Dan McNamara\n', { textStyle: { link: { url: 'https://linkedin.com/in/x' } } }),
    {
      table: {
        tableRows: [
          { tableCells: [{ content: [p('Perch Energy, Remote\n')] }, { content: [p('February 2026 - Present\n')] }] },
          {
            tableCells: [
              { content: [{ paragraph: { bullet: {}, elements: [{ textRun: { content: 'Led a migration\n' } }] } }] },
              { content: [p('\n')] },
            ],
          },
        ],
      },
    },
  ]);
  assert.equal(
    text,
    ['Dan McNamara (https://linkedin.com/in/x)', 'Perch Energy, Remote | February 2026 - Present', '- Led a migration'].join('\n'),
  );
});

test('seed resume.json is valid and free of contact details', async () => {
  const raw = JSON.parse(await readFile(new URL('../../src/data/resume.json', import.meta.url), 'utf8'));
  const resume = resumeSchema.parse(raw);
  assert.deepEqual(findPII(resume), []);
});

test('keepExistingSummary keeps the current summary only when the Doc has none', async () => {
  const current = resumeSchema.parse(
    JSON.parse(await readFile(new URL('../../src/data/resume.json', import.meta.url), 'utf8')),
  );
  const { summary: _, ...basicsWithout } = current.basics;
  const fromDocWithout = { ...current, basics: basicsWithout };

  // No summary in the Doc: the existing one is carried over.
  assert.equal(keepExistingSummary(fromDocWithout, current).basics.summary, current.basics.summary);
  // A summary in the Doc wins.
  const fromDocWith = { ...current, basics: { ...current.basics, summary: 'New from the Doc.' } };
  assert.equal(keepExistingSummary(fromDocWith, current).basics.summary, 'New from the Doc.');
  // Nothing to carry over: stays absent.
  assert.equal(keepExistingSummary(fromDocWithout, null).basics.summary, undefined);
  assert.equal(keepExistingSummary(fromDocWithout, { basics: { summary: '  ' } }).basics.summary, undefined);
});
