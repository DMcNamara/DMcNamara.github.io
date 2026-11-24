import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { flatten, findTab } from './docs';
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
