/**
 * Adds a "Website → Publish resume" menu to the resume Google Doc.
 * Clicking it starts the sync-resume GitHub Action, which opens a PR.
 *
 * Setup (in the doc: Extensions → Apps Script, paste this file):
 * 1. Project Settings → Script Properties → add GITHUB_TOKEN = a fine-grained PAT
 *    scoped to the site repo only, with "Contents: Read and write" permission.
 * 2. Edit REPO below if your repo name differs.
 * 3. Reload the doc and use the new Website menu. Authorize on first run.
 */
const REPO = 'DMcNamara/personal-site';

function onOpen() {
  DocumentApp.getUi()
    .createMenu('Website')
    .addItem('Publish resume', 'publishResume')
    .addToUi();
}

function publishResume() {
  const ui = DocumentApp.getUi();
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    ui.alert('Set GITHUB_TOKEN in Project Settings → Script Properties first.');
    return;
  }

  const res = UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    payload: JSON.stringify({ event_type: 'resume-updated' }),
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() === 204) {
    ui.alert('Sync started. A pull request will appear in a minute or two.');
  } else {
    ui.alert(`GitHub returned ${res.getResponseCode()}:\n${res.getContentText()}`);
  }
}
