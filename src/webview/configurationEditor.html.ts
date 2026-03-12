import { SonarConnection } from '../sonar/types';

type ConfigurationEditorModel = {
  connection: SonarConnection;
  hasToken: boolean;
  token: string;
  statusMessage: string;
  statusKind: 'info' | 'success' | 'error';
};

export function renderConfigurationEditorHtml(webview: import('vscode').Webview, model: ConfigurationEditorModel): string {
  const nonce = createNonce();
  const stateJson = JSON.stringify(model).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sonar Prompt Fixer Configuration</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg-a: color-mix(in srgb, var(--vscode-editor-background) 88%, #10243f);
        --bg-b: color-mix(in srgb, var(--vscode-sideBar-background) 84%, #231528);
        --panel: color-mix(in srgb, var(--vscode-editor-background) 92%, transparent);
        --panel-strong: color-mix(in srgb, var(--vscode-editor-background) 96%, transparent);
        --border: color-mix(in srgb, var(--vscode-panel-border) 80%, transparent);
        --text: var(--vscode-foreground);
        --muted: var(--vscode-descriptionForeground);
        --accent: var(--vscode-button-background);
        --accentText: var(--vscode-button-foreground);
        --shadow: 0 22px 60px color-mix(in srgb, black 28%, transparent);
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        color: var(--text);
        background:
          radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 28%, transparent), transparent 28%),
          radial-gradient(circle at bottom right, color-mix(in srgb, #d97706 16%, transparent), transparent 22%),
          linear-gradient(135deg, var(--bg-a), var(--bg-b));
        font: 14px/1.5 "Avenir Next", "Segoe UI", sans-serif;
      }
      .page {
        max-width: 1100px;
        margin: 0 auto;
        padding: 28px;
      }
      .hero {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: end;
        margin-bottom: 20px;
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 11px;
        color: color-mix(in srgb, var(--muted) 88%, white);
        margin-bottom: 10px;
      }
      h1 {
        margin: 0;
        font-size: clamp(28px, 4vw, 44px);
        line-height: 1.05;
        font-weight: 700;
      }
      .lead {
        max-width: 720px;
        margin: 12px 0 0;
        color: var(--muted);
        font-size: 15px;
      }
      .heroCard {
        min-width: 240px;
        padding: 16px 18px;
        border: 1px solid var(--border);
        border-radius: 18px;
        background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 92%, white 4%), var(--panel));
        box-shadow: var(--shadow);
      }
      .heroCard strong {
        display: block;
        font-size: 28px;
        line-height: 1;
      }
      .heroCard span {
        display: block;
        margin-top: 6px;
        color: var(--muted);
      }
      .grid {
        display: grid;
        grid-template-columns: 1.4fr 0.9fr;
        gap: 18px;
      }
      .panel {
        border: 1px solid var(--border);
        border-radius: 22px;
        background: linear-gradient(180deg, color-mix(in srgb, var(--panel-strong) 96%, white 4%), var(--panel));
        box-shadow: var(--shadow);
        overflow: hidden;
      }
      .panelHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 20px 12px;
      }
      .panelHeader h2 {
        margin: 0;
        font-size: 18px;
      }
      .panelBody {
        padding: 0 20px 20px;
      }
      .fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
      label {
        display: grid;
        gap: 7px;
        font-size: 13px;
        color: color-mix(in srgb, var(--text) 88%, white);
      }
      label.full {
        grid-column: 1 / -1;
      }
      input, select, button {
        font: inherit;
      }
      input, select {
        width: 100%;
        border-radius: 14px;
        border: 1px solid color-mix(in srgb, var(--border) 90%, white 5%);
        background: color-mix(in srgb, var(--vscode-input-background) 88%, white 3%);
        color: var(--text);
        padding: 11px 12px;
      }
      input:focus, select:focus {
        outline: 2px solid color-mix(in srgb, var(--accent) 72%, white 12%);
        outline-offset: 1px;
      }
      .hint {
        color: var(--muted);
        font-size: 12px;
        margin-top: -2px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }
      button {
        border: 1px solid transparent;
        border-radius: 999px;
        padding: 8px 13px;
        cursor: pointer;
        background: color-mix(in srgb, var(--vscode-button-secondaryBackground) 82%, transparent);
        color: var(--text);
        font-size: 13px;
      }
      button.primary {
        background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 74%, #ffffff 14%));
        color: var(--accentText);
      }
      .status {
        border-radius: 18px;
        padding: 14px 16px;
        border: 1px solid var(--border);
        font-size: 13px;
      }
      .status.info {
        background: color-mix(in srgb, var(--vscode-textLink-foreground) 10%, transparent);
      }
      .status.success {
        background: color-mix(in srgb, var(--vscode-testing-iconPassed) 14%, transparent);
      }
      .status.error {
        background: color-mix(in srgb, var(--vscode-errorForeground) 14%, transparent);
      }
      .stack {
        display: grid;
        gap: 16px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 8px 12px;
        background: color-mix(in srgb, var(--accent) 12%, transparent);
        color: var(--text);
        font-size: 12px;
      }
      .bulletList {
        display: grid;
        gap: 10px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .bulletList li {
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel) 92%, transparent);
      }
      @media (max-width: 900px) {
        .grid {
          grid-template-columns: 1fr;
        }
        .fields {
          grid-template-columns: 1fr;
        }
        .hero {
          flex-direction: column;
          align-items: stretch;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div>
          <div class="eyebrow">Sonar Prompt Fixer</div>
          <h1>Connection Workspace</h1>
          <p class="lead">Configure how the extension talks to SonarQube Cloud or Server, store your token securely, and validate access without leaving the editor.</p>
        </div>
        <aside class="heroCard">
          <strong id="tokenHeadline">Token missing</strong>
          <span id="tokenSubline">Save a token in SecretStorage to start fetching issues.</span>
        </aside>
      </section>

      <section class="grid">
        <article class="panel">
          <div class="panelHeader">
            <h2>Connection Settings</h2>
            <span class="badge" id="modeBadge">Cloud mode</span>
          </div>
          <div class="panelBody">
            <div class="fields">
              <label>
                Target type
                <select id="connectionType">
                  <option value="cloud">SonarQube Cloud</option>
                  <option value="server">SonarQube Server</option>
                </select>
              </label>
              <label>
                Base URL
                <input id="baseUrl" type="text" placeholder="https://sonarcloud.io" />
              </label>
              <label>
                Project key
                <input id="projectKey" type="text" placeholder="my-org_my-project" />
              </label>
              <label>
                Organization
                <input id="organization" type="text" placeholder="Required for most cloud setups" />
              </label>
              <label>
                Branch
                <input id="branch" type="text" placeholder="Optional branch" />
              </label>
              <label>
                Pull request
                <input id="pullRequest" type="text" placeholder="Optional PR id" />
              </label>
              <label>
                Auth mode
                <select id="authMode">
                  <option value="bearer">Bearer token</option>
                  <option value="basicToken">Basic token</option>
                </select>
                <span class="hint">Basic token is useful for some self-hosted SonarQube Server setups.</span>
              </label>
              <label>
                TLS verification
                <select id="verifyTls">
                  <option value="true">Verify TLS certificates</option>
                  <option value="false">Skip TLS verification</option>
                </select>
                <span class="hint">Only disable TLS verification if you trust the server and understand the risk.</span>
              </label>
              <label class="full">
                Token
                <input id="token" type="password" placeholder="Stored securely in VS Code SecretStorage" />
                <span class="hint">Edit or clear this password field, then click Save Settings.</span>
              </label>
            </div>
            <div class="actions">
              <button class="primary" id="saveConnection">Save Settings</button>
              <button id="testConnection">Test Connection</button>
            </div>
          </div>
        </article>

        <aside class="stack">
          <section class="panel">
            <div class="panelHeader">
              <h2>Status</h2>
            </div>
            <div class="panelBody">
              <div class="status" id="status"></div>
            </div>
          </section>
          <section class="panel">
            <div class="panelHeader">
              <h2>What This Saves</h2>
            </div>
            <div class="panelBody">
              <ul class="bulletList">
                <li>Connection settings are stored in normal VS Code settings.</li>
                <li>Your Sonar token is stored in VS Code SecretStorage.</li>
                <li>Clearing the password field and saving removes the stored token.</li>
              </ul>
            </div>
          </section>
        </aside>
      </section>
    </main>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const model = ${stateJson};

      const connectionType = document.getElementById('connectionType');
      const baseUrl = document.getElementById('baseUrl');
      const projectKey = document.getElementById('projectKey');
      const organization = document.getElementById('organization');
      const branch = document.getElementById('branch');
      const pullRequest = document.getElementById('pullRequest');
      const authMode = document.getElementById('authMode');
      const verifyTls = document.getElementById('verifyTls');
      const token = document.getElementById('token');
      const status = document.getElementById('status');
      const tokenHeadline = document.getElementById('tokenHeadline');
      const tokenSubline = document.getElementById('tokenSubline');
      const modeBadge = document.getElementById('modeBadge');

      function render(data) {
        connectionType.value = data.connection.type;
        baseUrl.value = data.connection.baseUrl || '';
        projectKey.value = data.connection.projectKey || '';
        organization.value = data.connection.organization || '';
        branch.value = data.connection.branch || '';
        pullRequest.value = data.connection.pullRequest || '';
        authMode.value = data.connection.authMode || 'bearer';
        verifyTls.value = String(data.connection.verifyTls !== false);
        token.value = data.token || '';
        organization.disabled = data.connection.type !== 'cloud';
        authMode.disabled = data.connection.type !== 'server';
        status.className = 'status ' + data.statusKind;
        status.textContent = data.statusMessage;
        modeBadge.textContent = data.connection.type === 'cloud' ? 'Cloud mode' : 'Server mode';
        tokenHeadline.textContent = data.hasToken ? 'Token stored' : 'Token missing';
        tokenSubline.textContent = data.hasToken
          ? 'You can edit the stored token directly in the password field.'
          : 'Save a token in SecretStorage to start fetching issues.';
      }

      document.getElementById('saveConnection').addEventListener('click', () => {
        vscode.postMessage({
          type: 'saveConfiguration',
          connection: {
            type: connectionType.value,
            baseUrl: baseUrl.value,
            projectKey: projectKey.value,
            organization: organization.value,
            branch: branch.value,
            pullRequest: pullRequest.value,
            authMode: authMode.value,
            verifyTls: verifyTls.value === 'true'
          },
          token: token.value
        });
      });

      document.getElementById('testConnection').addEventListener('click', () => {
        vscode.postMessage({ type: 'testConnection' });
      });

      connectionType.addEventListener('change', () => {
        modeBadge.textContent = connectionType.value === 'cloud' ? 'Cloud mode' : 'Server mode';
        organization.disabled = connectionType.value !== 'cloud';
        authMode.disabled = connectionType.value !== 'server';
      });

      window.addEventListener('message', (event) => render(event.data));
      render(model);
    </script>
  </body>
</html>`;
}

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < 24; index += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}
