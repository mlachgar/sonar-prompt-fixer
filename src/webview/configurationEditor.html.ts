import { randomBytes } from 'node:crypto';
import { SonarConnectionProfile, SonarProfileConnection } from '../sonar/types';
import { SonarProjectProperties } from '../util/sonarProjectProperties';
import { SonarWorkspaceProject } from '../util/sonarWorkspaceProjects';

type ConfigurationEditorModel = {
  profiles: Array<{
    id: string;
    name: string;
    type: SonarProfileConnection['type'];
    baseUrl: string;
  }>;
  activeProfile?: SonarConnectionProfile;
  defaultConnection: SonarProfileConnection;
  activeProject?: SonarWorkspaceProject;
  projectConfiguration: SonarProjectProperties;
  hasToken: boolean;
  token: string;
  statusMessage: string;
  statusKind: 'info' | 'success' | 'error';
};

export function renderConfigurationEditorHtml(webview: import('vscode').Webview, model: ConfigurationEditorModel): string {
  const nonce = createNonce();
  const stateJson = JSON.stringify(model).replaceAll('<', String.raw`\u003c`);

  return String.raw`<!DOCTYPE html>
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
        max-width: 1180px;
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
        max-width: 760px;
        margin: 12px 0 0;
        color: var(--muted);
        font-size: 15px;
      }
      .heroCard {
        min-width: 280px;
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
        grid-template-columns: 1.45fr 0.95fr;
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
      .profileToolbar {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 14px;
        align-items: start;
        margin-bottom: 18px;
      }
      .profileToolbarActions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        align-self: start;
        padding-top: 24px;
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
        flex-wrap: nowrap;
        gap: 10px;
      }
      .formFooter {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        margin-top: 20px;
        padding-top: 18px;
        border-top: 1px solid var(--border);
      }
      .viewNote {
        margin-top: 16px;
        color: var(--muted);
        font-size: 12px;
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
      button.danger {
        background: color-mix(in srgb, var(--vscode-errorForeground) 18%, transparent);
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
        .profileToolbar {
          grid-template-columns: 1fr;
        }
        .profileToolbarActions {
          justify-content: stretch;
          padding-top: 0;
        }
        .profileToolbarActions button {
          flex: 1;
        }
        .fields {
          grid-template-columns: 1fr;
        }
        .formFooter {
          justify-content: stretch;
        }
        .actions {
          width: 100%;
        }
        .actions button {
          flex: 1 1 0;
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
          <p class="lead">Save multiple SonarQube Cloud and Server profiles, keep a token per profile, and let each workspace provide its project key from <code>sonar-project.properties</code>.</p>
        </div>
        <aside class="heroCard">
          <strong id="tokenHeadline">Token missing</strong>
          <span id="tokenSubline">Save a token in SecretStorage to start fetching issues.</span>
        </aside>
      </section>

      <section class="grid">
        <article class="panel">
          <div class="panelHeader">
            <h2>Connection Profiles</h2>
            <span class="badge" id="modeBadge">Cloud mode</span>
          </div>
          <div class="panelBody">
            <div class="profileToolbar">
              <label>
                Editing profile
                <select id="profileSelect"></select>
                <span class="hint">Only saved profiles appear here. Use New Profile to create one.</span>
              </label>
              <div class="profileToolbarActions">
                <button id="newProfile">New Profile</button>
                <button class="danger" id="deleteProfile">Delete Profile</button>
              </div>
            </div>
            <div class="fields">
              <label class="full">
                Profile name
                <input id="profileName" type="text" placeholder="Production Cloud" />
              </label>
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
                <span class="hint">Each saved profile can keep its own token. Clear the field and save to remove it.</span>
              </label>
            </div>
            <div class="formFooter">
              <div class="actions">
                <button id="testConnection">Test Connection</button>
                <button class="primary" id="saveProfile">Save Profile</button>
              </div>
            </div>
            <div class="viewNote">Save makes this profile available across workspaces. Test Connection validates the current form against the detected project.</div>
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
                <li>Each profile stores only server-level connection details and can be made active instantly.</li>
                <li>Tokens stay in VS Code SecretStorage instead of normal settings.</li>
                <li>The current workspace supplies <code>sonar.projectKey</code> and <code>sonar.organization</code> from <code>sonar-project.properties</code>.</li>
              </ul>
            </div>
          </section>
          <section class="panel">
            <div class="panelHeader">
              <h2>Detected Project</h2>
            </div>
            <div class="panelBody">
              <ul class="bulletList">
                <li id="detectedProjectDirectory">Project directory: not selected</li>
                <li id="detectedProjectKey">Project key: not found</li>
                <li id="detectedOrganization">Organization: not found</li>
              </ul>
            </div>
          </section>
        </aside>
      </section>
    </main>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const model = ${stateJson};

      const profileSelect = document.getElementById('profileSelect');
      const profileName = document.getElementById('profileName');
      const connectionType = document.getElementById('connectionType');
      const baseUrl = document.getElementById('baseUrl');
      const branch = document.getElementById('branch');
      const pullRequest = document.getElementById('pullRequest');
      const authMode = document.getElementById('authMode');
      const verifyTls = document.getElementById('verifyTls');
      const token = document.getElementById('token');
      const status = document.getElementById('status');
      const tokenHeadline = document.getElementById('tokenHeadline');
      const tokenSubline = document.getElementById('tokenSubline');
      const modeBadge = document.getElementById('modeBadge');
      const detectedProjectDirectory = document.getElementById('detectedProjectDirectory');
      const detectedProjectKey = document.getElementById('detectedProjectKey');
      const detectedOrganization = document.getElementById('detectedOrganization');
      const deleteProfileButton = document.getElementById('deleteProfile');
      let currentProfileId = '';

      function makeBlankDraft() {
        return {
          id: '',
          name: '',
          connection: structuredClone(model.defaultConnection),
          token: ''
        };
      }

      function currentDraft() {
        return {
          id: currentProfileId,
          name: profileName.value,
          connection: {
            type: connectionType.value,
            baseUrl: baseUrl.value,
            branch: branch.value,
            pullRequest: pullRequest.value,
            authMode: authMode.value,
            verifyTls: verifyTls.value === 'true'
          },
          token: token.value
        };
      }

      function syncForm(draft) {
        currentProfileId = draft.id || '';
        profileName.value = draft.name || '';
        connectionType.value = draft.connection.type || 'cloud';
        baseUrl.value = draft.connection.baseUrl || '';
        branch.value = draft.connection.branch || '';
        pullRequest.value = draft.connection.pullRequest || '';
        authMode.value = draft.connection.authMode || 'bearer';
        verifyTls.value = String(draft.connection.verifyTls !== false);
        token.value = draft.token || '';
        authMode.disabled = connectionType.value !== 'server';
        modeBadge.textContent = connectionType.value === 'cloud' ? 'Cloud mode' : 'Server mode';
        deleteProfileButton.disabled = !currentProfileId;
      }

      function renderProfileOptions(data) {
        profileSelect.innerHTML = '';
        data.profiles.forEach((profile) => {
          const option = document.createElement('option');
          option.value = profile.id;
          option.textContent = profile.name;
          profileSelect.appendChild(option);
        });
        profileSelect.disabled = data.profiles.length === 0;
        if (data.activeProfile) {
          profileSelect.value = data.activeProfile.id;
        }
      }

      function render(data) {
        renderProfileOptions(data);
        syncForm(data.activeProfile ? {
          id: data.activeProfile.id,
          name: data.activeProfile.name,
          connection: data.activeProfile.connection,
          token: data.token || ''
        } : makeBlankDraft());
        status.className = 'status ' + data.statusKind;
        status.textContent = data.statusMessage;
        tokenHeadline.textContent = data.hasToken ? 'Token stored' : 'Token missing';
        tokenSubline.textContent = data.hasToken
          ? 'This active profile already has a token available for requests.'
          : 'Save a token in SecretStorage to start fetching issues.';
        detectedProjectDirectory.textContent = data.activeProject
          ? 'Project directory: ' + data.activeProject.label
          : 'Project directory: not selected';
        detectedProjectKey.textContent = data.projectConfiguration.projectKey
          ? 'Project key: ' + data.projectConfiguration.projectKey
          : 'Project key: not found in sonar-project.properties';
        detectedOrganization.textContent = data.projectConfiguration.organization
          ? 'Organization: ' + data.projectConfiguration.organization
          : 'Organization: not found';
      }

      document.getElementById('newProfile').addEventListener('click', () => {
        syncForm(makeBlankDraft());
        status.className = 'status info';
        status.textContent = 'Drafting a new profile. Save it when you are ready.';
      });

      document.getElementById('saveProfile').addEventListener('click', () => {
        const draft = currentDraft();
        vscode.postMessage({
          type: 'saveProfile',
          profile: {
            id: draft.id,
            name: draft.name,
            connection: draft.connection
          },
          token: draft.token
        });
      });

      document.getElementById('testConnection').addEventListener('click', () => {
        const draft = currentDraft();
        vscode.postMessage({
          type: 'testConnection',
          connection: draft.connection,
          token: draft.token
        });
      });

      document.getElementById('deleteProfile').addEventListener('click', () => {
        if (!currentProfileId) {
          return;
        }
        vscode.postMessage({ type: 'deleteProfile', profileId: currentProfileId });
      });

      profileSelect.addEventListener('change', () => {
        vscode.postMessage({ type: 'selectProfile', profileId: profileSelect.value });
      });

      connectionType.addEventListener('change', () => {
        modeBadge.textContent = connectionType.value === 'cloud' ? 'Cloud mode' : 'Server mode';
        authMode.disabled = connectionType.value !== 'server';
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
