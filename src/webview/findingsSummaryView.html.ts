import { randomBytes } from 'node:crypto';

type SummaryMode = 'issues' | 'coverage' | 'duplication' | 'hotspots';

type FindingsSummaryModel = {
  loading: boolean;
  activeProfileId: string;
  activeProfileName: string;
  activeProfileTarget: string;
  profiles: Array<{
    id: string;
    name: string;
    target: string;
  }>;
  counts: Array<{
    mode: SummaryMode;
    label: string;
    count: number;
    accent: string;
  }>;
};

export function renderFindingsSummaryHtml(webview: import('vscode').Webview, model: FindingsSummaryModel): string {
  const nonce = createNonce();
  const stateJson = JSON.stringify(model).replaceAll('<', String.raw`\u003c`);

  return String.raw`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Findings</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: var(--vscode-sideBar-background);
        --panel: color-mix(in srgb, var(--vscode-editor-background) 90%, transparent);
        --border: color-mix(in srgb, var(--vscode-panel-border) 78%, transparent);
        --text: var(--vscode-foreground);
        --muted: var(--vscode-descriptionForeground);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top right, color-mix(in srgb, var(--vscode-button-background) 16%, transparent), transparent 30%),
          linear-gradient(180deg, color-mix(in srgb, var(--bg) 94%, #10243f 6%), var(--bg));
        color: var(--text);
        font: 13px/1.45 "Avenir Next", "Segoe UI", sans-serif;
      }
      .page {
        padding: 14px;
        display: grid;
        gap: 12px;
      }
      .hero {
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 14px;
        background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 95%, white 3%), var(--panel));
      }
      .toolbar {
        display: flex;
        gap: 8px;
        align-items: end;
      }
      .toolbarLabel {
        display: grid;
        gap: 6px;
        flex: 1;
        min-width: 0;
        font-size: 12px;
        color: var(--muted);
      }
      select, button.toolbarButton {
        border-radius: 12px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--vscode-input-background) 88%, white 3%);
        color: var(--text);
        padding: 9px 10px;
        font: inherit;
      }
      select {
        flex: 1;
        width: 100%;
      }
      button.toolbarButton {
        width: 44px;
        min-width: 44px;
        height: 44px;
        padding: 0;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        line-height: 1;
      }
      .status {
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 10px 12px;
        background: color-mix(in srgb, var(--panel) 92%, transparent);
        color: var(--muted);
      }
      .cards {
        display: grid;
        gap: 10px;
      }
      button.card {
        width: 100%;
        text-align: left;
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 12px 14px;
        background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, white 4%), var(--panel));
        color: var(--text);
        cursor: pointer;
      }
      button.card:hover {
        border-color: color-mix(in srgb, var(--vscode-focusBorder) 75%, var(--border));
      }
      .cardHead {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
      }
      .label {
        font-size: 13px;
        color: var(--muted);
      }
      .count {
        font-size: 30px;
        line-height: 1;
        font-weight: 800;
      }
      .open {
        margin-top: 8px;
        font-size: 12px;
      }
      .spinner {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        border: 2px solid color-mix(in srgb, var(--muted) 35%, transparent);
        border-top-color: var(--text);
        display: inline-block;
        vertical-align: text-bottom;
        margin-right: 8px;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div class="toolbar">
          <label class="toolbarLabel">Profile
            <select id="profileSelect" aria-label="Select profile"></select>
          </label>
          <button class="toolbarButton" id="refreshButton" type="button" aria-label="Refresh findings" title="Refresh findings">&#x21bb;</button>
        </div>
      </section>
      <section class="status" id="status"></section>
      <section class="cards" id="cards"></section>
    </main>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const model = ${stateJson};
      const profileSelect = document.getElementById('profileSelect');
      const refreshButton = document.getElementById('refreshButton');
      const status = document.getElementById('status');
      const cards = document.getElementById('cards');
      let syncingProfileSelect = false;

      function render(data) {
        syncingProfileSelect = true;
        profileSelect.innerHTML = '';
        for (const profile of data.profiles) {
          const option = document.createElement('option');
          option.value = profile.id;
          option.textContent = profile.name;
          profileSelect.appendChild(option);
        }
        profileSelect.value = data.activeProfileId;
        syncingProfileSelect = false;

        profileSelect.disabled = data.loading;
        refreshButton.disabled = data.loading;
        status.innerHTML = data.loading
          ? '<span class="spinner"></span>Fetching Sonar findings...'
          : '';
        status.hidden = !data.loading;

        cards.innerHTML = '';
        for (const item of data.counts) {
          const button = document.createElement('button');
          button.className = 'card';
          button.type = 'button';
          button.dataset.mode = item.mode;
          button.innerHTML = [
            '<div class="cardHead">',
            '<div>',
            '<div class="label">' + item.label + '</div>',
            '<div class="count" style="color:' + item.accent + '">' + item.count + '</div>',
            '</div>',
            '</div>',
            '<div class="open">Open ' + item.label + ' workspace</div>'
          ].join('');
          button.addEventListener('click', () => {
            vscode.postMessage({ type: 'openMode', mode: item.mode });
          });
          cards.appendChild(button);
        }
      }

      profileSelect.addEventListener('change', () => {
        if (syncingProfileSelect) {
          return;
        }
        vscode.postMessage({ type: 'selectProfile', profileId: profileSelect.value });
      });

      refreshButton.addEventListener('click', () => {
        vscode.postMessage({ type: 'refresh' });
      });

      window.addEventListener('message', (event) => render(event.data));
      render(model);
    </script>
  </body>
</html>`;
}

function createNonce(): string {
  return randomBytes(18).toString('base64url');
}
