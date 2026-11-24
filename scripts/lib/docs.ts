import { google, type docs_v1 } from 'googleapis';

type Tab = docs_v1.Schema$Tab;
type Element = docs_v1.Schema$StructuralElement;

/**
 * Fetches one tab of a Google Doc as plain text.
 *
 * Auth comes from Application Default Credentials: in GitHub Actions,
 * google-github-actions/auth sets GOOGLE_APPLICATION_CREDENTIALS; locally,
 * `gcloud auth application-default login` works too.
 */
export async function fetchTabText(documentId: string, tabId: string): Promise<string> {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/documents.readonly'],
  });
  const docs = google.docs({ version: 'v1', auth });

  const { data } = await docs.documents.get({
    documentId,
    includeTabsContent: true,
    // Only the fields we read: the full doc with styles is several MB.
    fields: 'title,tabs',
  });

  const tab = findTab(data.tabs ?? [], tabId);
  if (!tab) {
    const known = listTabs(data.tabs ?? []).join('\n  ');
    throw new Error(`Tab ${tabId} not found in "${data.title}". Tabs:\n  ${known}`);
  }

  const text = flatten(tab.documentTab?.body?.content ?? []).trim();
  if (!text) throw new Error(`Tab ${tabId} is empty`);
  return text;
}

/** Depth-first search, including nested child tabs. */
export function findTab(tabs: Tab[], id: string): Tab | undefined {
  for (const t of tabs) {
    if (t.tabProperties?.tabId === id) return t;
    const hit = t.childTabs && findTab(t.childTabs, id);
    if (hit) return hit;
  }
  return undefined;
}

function listTabs(tabs: Tab[], depth = 0): string[] {
  return tabs.flatMap((t) => [
    `${'  '.repeat(depth)}${t.tabProperties?.tabId}  "${t.tabProperties?.title}"`,
    ...listTabs(t.childTabs ?? [], depth + 1),
  ]);
}

/**
 * Converts structural elements to text the LLM can read reliably:
 * bullets become "- " lines, link URLs are kept in parentheses, and a table
 * row whose cells are each one line is joined with " | " so that
 * "Perch Energy, Remote | February 2026 - Present" stays together.
 */
export function flatten(content: Element[]): string {
  const lines: string[] = [];
  for (const el of content) {
    if (el.paragraph) {
      const line = paragraphText(el.paragraph);
      if (line) lines.push(line);
    } else if (el.table) {
      for (const row of el.table.tableRows ?? []) {
        const cells = (row.tableCells ?? [])
          .map((cell) => flatten(cell.content ?? []).trim())
          .filter(Boolean);
        if (cells.length === 0) continue;
        if (cells.every((c) => !c.includes('\n'))) {
          lines.push(cells.join(' | '));
        } else {
          lines.push(...cells);
        }
      }
    }
    // sectionBreak, tableOfContents: nothing to extract
  }
  return lines.join('\n');
}

function paragraphText(p: docs_v1.Schema$Paragraph): string {
  let text = '';
  for (const el of p.elements ?? []) {
    const run = el.textRun;
    if (!run?.content) continue;
    const chunk = run.content.replace(/\n$/, '');
    const url = run.textStyle?.link?.url;
    text += url && chunk.trim() ? `${chunk} (${url})` : chunk;
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return p.bullet ? `- ${text}` : text;
}
