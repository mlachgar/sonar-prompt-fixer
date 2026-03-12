import { IssueFilters, SonarIssue } from '../sonar/types';
import { PromptStyle, PromptTarget } from '../prompt/types';

type IssuesWorkspaceModel = {
  selectedCount: number;
  visibleCount: number;
  totalCount: number;
  filters: IssueFilters;
  target: PromptTarget;
  style: PromptStyle;
  prompt: string;
  projectKey: string;
  issues: Array<SonarIssue & { selected: boolean }>;
};

export function renderIssuesWorkspaceHtml(webview: import('vscode').Webview, model: IssuesWorkspaceModel): string {
  const nonce = createNonce();
  const stateJson = JSON.stringify(model).replaceAll('<', String.raw`\u003c`);

  return String.raw`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sonar Prompt Fixer Issues Workspace</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg-a: color-mix(in srgb, var(--vscode-editor-background) 92%, #0a2a43);
        --bg-b: color-mix(in srgb, var(--vscode-sideBar-background) 88%, #16161b);
        --panel: color-mix(in srgb, var(--vscode-editor-background) 94%, transparent);
        --border: color-mix(in srgb, var(--vscode-panel-border) 80%, transparent);
        --text: var(--vscode-foreground);
        --muted: var(--vscode-descriptionForeground);
        --accent: var(--vscode-button-background);
        --accentText: var(--vscode-button-foreground);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--text);
        background:
          radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 18%, transparent), transparent 28%),
          linear-gradient(135deg, var(--bg-a), var(--bg-b));
        font: 13px/1.5 "Avenir Next", "Segoe UI", sans-serif;
        min-height: 100vh;
      }
      .page {
        padding: 22px;
        max-width: 1480px;
        margin: 0 auto;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .hero { display: flex; justify-content: space-between; align-items: end; gap: 16px; margin-bottom: 18px; }
      h1 { margin: 0; font-size: 32px; line-height: 1.05; }
      .lead { margin: 8px 0 0; color: var(--muted); }
      .stats { display: flex; gap: 10px; flex-wrap: wrap; }
      .chip { border: 1px solid var(--border); background: color-mix(in srgb, var(--panel) 92%, white 4%); border-radius: 999px; padding: 8px 12px; }
      .layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; align-items: start; flex: 1; min-height: 0; }
      .panel { border: 1px solid var(--border); background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, white 3%), var(--panel)); border-radius: 18px; overflow: hidden; }
      .toolbar, .filters, .promptToolbar { padding: 14px 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; border-bottom: 1px solid var(--border); }
      .filters { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); align-items: start; }
      label { display: grid; gap: 6px; font-size: 12px; color: var(--muted); }
      input, select, button, textarea { font: inherit; }
      input, select, textarea {
        width: 100%;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--vscode-input-background);
        color: var(--text);
        padding: 8px 10px;
      }
      button { border: 1px solid transparent; border-radius: 999px; padding: 8px 12px; cursor: pointer; background: color-mix(in srgb, var(--vscode-button-secondaryBackground) 82%, transparent); color: var(--text); }
      button:disabled { cursor: not-allowed; opacity: 0.65; }
      button.primary { background: var(--accent); color: var(--accentText); }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
      th { font-size: 12px; color: var(--muted); background: color-mix(in srgb, var(--panel) 96%, transparent); position: sticky; top: 0; }
      .tableWrap { max-height: calc(100vh - 340px); overflow-y: auto; overflow-x: hidden; }
      .message { min-width: 320px; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
      .severity, .type { display: inline-block; border-radius: 999px; padding: 3px 8px; font-size: 11px; border: 1px solid var(--border); }
      .empty { padding: 28px 16px; color: var(--muted); }
      .promptPanel {
        min-height: calc(100vh - 190px);
        display: flex;
        flex-direction: column;
      }
      .promptPanel textarea {
        min-height: 420px;
        height: 100%;
        flex: 1;
        resize: vertical;
        border: 0;
        border-radius: 0;
        background: transparent;
      }
      .promptPanel .panelBody {
        padding: 0 0 10px;
        flex: 1;
        min-height: 0;
      }
      .panelBody { padding: 0; }
      .stepTitle { margin: 0; font-size: 16px; }
      .stepLead { margin: 4px 0 0; color: var(--muted); }
      .tableHint { padding: 10px 16px 14px; color: var(--muted); border-top: 1px solid var(--border); }
      .wrap { word-break: break-word; overflow-wrap: anywhere; }
      .checkCell { width: 60px; }
      .severityCell { width: 110px; }
      .typeCell { width: 140px; }
      .statusCell { width: 130px; }
      .ruleCell { width: 190px; }
      .locationCell { width: 260px; }
      .comboLabel { position: relative; }
      .combo { position: relative; }
      .comboButton {
        width: 100%;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--vscode-input-background);
        color: var(--text);
        padding: 8px 10px;
        text-align: left;
      }
      .comboMenu {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        z-index: 10;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: color-mix(in srgb, var(--panel) 98%, var(--vscode-input-background) 2%);
        box-shadow: 0 10px 24px color-mix(in srgb, black 18%, transparent);
        padding: 6px;
        display: none;
        max-height: 240px;
        overflow-y: auto;
      }
      .combo.open .comboMenu { display: block; }
      .comboOption {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 8px;
        color: var(--text);
      }
      .comboOption:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
      .comboOption input { width: auto; margin: 0; }
      .stepPanel[hidden] { display: none; }
      .promptToolbar {
        justify-content: space-between;
      }
      .stepToolbar {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border);
      }
      .stepNav {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .stepNav button {
        min-width: 120px;
        min-height: 42px;
        padding: 10px 18px;
        border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border));
        background: color-mix(in srgb, var(--accent) 22%, var(--panel));
        color: var(--text);
        font-weight: 600;
        box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 16%, transparent);
      }
      .stepNav button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--accent) 30%, var(--panel));
        border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
      }
      .stepNav button:disabled {
        opacity: 0.5;
        box-shadow: none;
      }
      .promptActions {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        flex-wrap: wrap;
      }
      .promptBox {
        position: relative;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .iconButton {
        width: 34px;
        height: 34px;
        padding: 0;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .copyPromptButton {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 1;
      }
      .copyPromptButton svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
      }
      .promptPanel textarea {
        padding-top: 44px;
      }
      @media (max-width: 1250px) {
        .promptPanel { min-height: calc(100vh - 170px); }
        .promptPanel textarea { min-height: 260px; }
      }
      @media (max-width: 1100px) { .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 700px) {
        .hero { flex-direction: column; align-items: stretch; }
        .filters { grid-template-columns: 1fr; }
        .stepToolbar { flex-direction: column; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div>
          <h1>Issues Workspace</h1>
          <p class="lead">Review Sonar findings, manage filters, and generate a remediation prompt in one editor view.</p>
        </div>
        <div class="stats">
          <div class="chip" id="totalCount"></div>
          <div class="chip" id="visibleCount"></div>
          <div class="chip" id="selectedCount"></div>
        </div>
      </section>

      <section class="layout">
        <section class="panel stepPanel" id="issuesPanel">
          <div class="stepToolbar">
            <div>
              <h2 class="stepTitle">Step 1: Select issues</h2>
              <p class="stepLead">Filter the list and choose the findings to include in the generated remediation prompt.</p>
            </div>
            <div class="stepNav">
              <button type="button" id="nextStep">Next</button>
            </div>
          </div>
          <div class="toolbar">
            <button id="refresh">Refresh</button>
            <button id="openConfig">Configuration</button>
            <button id="selectVisible">Select Visible</button>
            <button id="clearSelection">Clear Selection</button>
            <button id="clearFilters">Clear Filters</button>
          </div>
          <div class="filters">
            <label class="comboLabel">Type
              <div class="combo" id="typesCombo">
                <button type="button" class="comboButton" id="typesButton"></button>
                <div class="comboMenu" id="typesMenu"></div>
              </div>
            </label>
            <label class="comboLabel">Severity
              <div class="combo" id="severitiesCombo">
                <button type="button" class="comboButton" id="severitiesButton"></button>
                <div class="comboMenu" id="severitiesMenu"></div>
              </div>
            </label>
            <label class="comboLabel">Status
              <div class="combo" id="statusesCombo">
                <button type="button" class="comboButton" id="statusesButton"></button>
                <div class="comboMenu" id="statusesMenu"></div>
              </div>
            </label>
            <label>Rule contains
              <input id="ruleQuery" type="text" placeholder="typescript:S1234" />
            </label>
            <label>File or component contains
              <input id="componentQuery" type="text" placeholder="src/app" />
            </label>
          </div>
          <div class="tableWrap">
            <table>
              <colgroup>
                <col class="checkCell" />
                <col class="severityCell" />
                <col class="typeCell" />
                <col class="statusCell" />
                <col class="ruleCell" />
                <col class="locationCell" />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Rule</th>
                  <th>Location</th>
                  <th class="message">Message</th>
                </tr>
              </thead>
              <tbody id="issuesBody"></tbody>
            </table>
            <div class="empty" id="emptyState" hidden>No issues match the current filters.</div>
          </div>
          <div class="tableHint" id="tableHint"></div>
        </section>

        <section class="panel promptPanel stepPanel" id="promptPanel" hidden>
          <div class="stepToolbar">
            <div>
              <h2 class="stepTitle">Step 2: Generate the prompt</h2>
              <p class="stepLead">Once the right issues are selected, choose the target format and generate the remediation prompt.</p>
            </div>
            <div class="stepNav">
              <button type="button" id="previousStep">Previous</button>
            </div>
          </div>
          <div class="promptToolbar">
            <div class="promptActions">
              <label>Target
                <select id="target">
                  <option value="codex">Codex</option>
                  <option value="claude">Claude Code</option>
                  <option value="qwen">Qwen Code</option>
                </select>
              </label>
              <label>Style
                <select id="style">
                  <option value="minimal">Minimal</option>
                  <option value="balanced">Balanced</option>
                  <option value="guided">Guided</option>
                </select>
              </label>
              <button class="primary" id="generatePrompt">Generate Prompt</button>
            </div>
          </div>
          <div class="panelBody promptBox">
            <button id="copyPrompt" class="iconButton copyPromptButton" title="Copy prompt" aria-label="Copy prompt">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"/>
              </svg>
            </button>
            <textarea id="prompt" readonly placeholder="Select issues and generate a prompt."></textarea>
          </div>
        </section>
      </section>
    </main>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const model = ${stateJson};
      const totalCount = document.getElementById('totalCount');
      const visibleCount = document.getElementById('visibleCount');
      const selectedCount = document.getElementById('selectedCount');
      const issuesBody = document.getElementById('issuesBody');
      const emptyState = document.getElementById('emptyState');
      const tableHint = document.getElementById('tableHint');
      const promptPanel = document.getElementById('promptPanel');
      const ruleQuery = document.getElementById('ruleQuery');
      const componentQuery = document.getElementById('componentQuery');
      const target = document.getElementById('target');
      const style = document.getElementById('style');
      const prompt = document.getElementById('prompt');
      const generatePromptButton = document.getElementById('generatePrompt');
      const copyPromptButton = document.getElementById('copyPrompt');
      const nextStepButton = document.getElementById('nextStep');
      const previousStepButton = document.getElementById('previousStep');
      const issuesPanel = document.getElementById('issuesPanel');
      const comboConfigs = [
        { key: 'types', label: 'Type', values: ['BUG', 'VULNERABILITY', 'CODE_SMELL'] },
        { key: 'severities', label: 'Severity', values: ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'] },
        { key: 'statuses', label: 'Status', values: ['OPEN', 'CONFIRMED', 'REOPENED', 'RESOLVED', 'ACCEPTED', 'FALSE-POSITIVE'] }
      ];
      const comboState = Object.fromEntries(comboConfigs.map((config) => [config.key, []]));
      let currentStep = 1;

      function createCombo(config) {
        const combo = document.getElementById(config.key + 'Combo');
        const button = document.getElementById(config.key + 'Button');
        const menu = document.getElementById(config.key + 'Menu');

        for (const value of config.values) {
          const option = document.createElement('label');
          option.className = 'comboOption';
          option.innerHTML = '<input type="checkbox" value="' + value + '" /> <span>' + value + '</span>';
          const checkbox = option.querySelector('input');
          checkbox.addEventListener('change', () => {
            comboState[config.key] = Array.from(menu.querySelectorAll('input:checked')).map((input) => input.value);
            updateComboButton(config);
            postFilters();
          });
          menu.appendChild(option);
        }

        button.addEventListener('click', () => {
          const isOpen = combo.classList.contains('open');
          closeAllCombos();
          combo.classList.toggle('open', !isOpen);
        });

        updateComboButton(config);
      }

      function closeAllCombos() {
        for (const config of comboConfigs) {
          document.getElementById(config.key + 'Combo').classList.remove('open');
        }
      }

      function updateComboButton(config) {
        const button = document.getElementById(config.key + 'Button');
        const values = comboState[config.key];
        button.textContent = values.length === 0
          ? 'All'
          : values.length <= 2
            ? values.join(', ')
            : values.length + ' selected';
      }

      function applyComboSelection(key, values) {
        comboState[key] = [...values];
        const menu = document.getElementById(key + 'Menu');
        for (const input of menu.querySelectorAll('input')) {
          input.checked = values.includes(input.value);
        }
        const config = comboConfigs.find((entry) => entry.key === key);
        updateComboButton(config);
      }

      function syncTextInput(input, value) {
        if (document.activeElement !== input) {
          input.value = value;
        }
      }

      function setStep(step, options = {}) {
        if (step === 2 && nextStepButton.disabled && !options.force) {
          return;
        }
        currentStep = step;
        const showIssues = step === 1;
        issuesPanel.hidden = !showIssues;
        promptPanel.hidden = showIssues;
      }

      for (const config of comboConfigs) {
        createCombo(config);
      }

      function postFilters() {
        vscode.postMessage({
          type: 'setFilters',
          filters: {
            types: comboState.types,
            severities: comboState.severities,
            statuses: comboState.statuses,
            ruleQuery: ruleQuery.value.trim(),
            componentQuery: componentQuery.value.trim()
          }
        });
      }

      function toRelativeComponent(component, projectKey) {
        if (projectKey && component.startsWith(projectKey + ':')) {
          return component.slice(projectKey.length + 1);
        }
        const lastColon = component.lastIndexOf(':');
        if (lastColon >= 0 && /[\\/]/.test(component.slice(lastColon + 1))) {
          return component.slice(lastColon + 1);
        }
        return component;
      }

      function render(data) {
        totalCount.textContent = data.totalCount + ' total';
        visibleCount.textContent = data.visibleCount + ' visible';
        selectedCount.textContent = data.selectedCount + ' selected';
        applyComboSelection('types', data.filters.types || []);
        applyComboSelection('severities', data.filters.severities || []);
        applyComboSelection('statuses', data.filters.statuses || []);
        syncTextInput(ruleQuery, data.filters.ruleQuery || '');
        syncTextInput(componentQuery, data.filters.componentQuery || '');
        target.value = data.target;
        style.value = data.style;
        prompt.value = data.prompt || '';
        nextStepButton.disabled = data.selectedCount === 0;
        generatePromptButton.disabled = data.selectedCount === 0;
        copyPromptButton.disabled = !data.prompt;
        tableHint.textContent = data.selectedCount > 0
          ? 'Selection ready. Continue to step 2 to generate the prompt.'
          : 'Select one or more issues to unlock step 2.';
        if (data.selectedCount === 0 && currentStep === 2) {
          setStep(1, { force: true });
        } else if (data.prompt && currentStep !== 2) {
          setStep(2, { force: true });
        } else {
          setStep(currentStep, { force: true });
        }
        issuesBody.innerHTML = '';
        emptyState.hidden = data.issues.length > 0;

        for (const issue of data.issues) {
          const row = document.createElement('tr');
          const locationBase = toRelativeComponent(issue.component, data.projectKey);
          const location = issue.line ? locationBase + ':' + issue.line : locationBase;
          row.innerHTML = [
            '<td><input type="checkbox" data-key="' + issue.key + '"' + (issue.selected ? ' checked' : '') + ' /></td>',
            '<td><span class="severity">' + issue.severity + '</span></td>',
            '<td><span class="type">' + issue.type + '</span></td>',
            '<td class="wrap">' + escapeHtml(issue.status || 'OPEN') + '</td>',
            '<td class="mono wrap">' + escapeHtml(issue.rule) + '</td>',
            '<td class="mono wrap">' + escapeHtml(location) + '</td>',
            '<td class="message wrap">' + escapeHtml(issue.message) + '</td>'
          ].join('');
          issuesBody.appendChild(row);
        }
      }

      function escapeHtml(value) {
        return value
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;');
      }

      document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
      document.getElementById('openConfig').addEventListener('click', () => vscode.postMessage({ type: 'openConfig' }));
      document.getElementById('selectVisible').addEventListener('click', () => vscode.postMessage({ type: 'selectVisible' }));
      document.getElementById('clearSelection').addEventListener('click', () => vscode.postMessage({ type: 'clearSelection' }));
      document.getElementById('clearFilters').addEventListener('click', () => vscode.postMessage({ type: 'clearFilters' }));
      document.getElementById('generatePrompt').addEventListener('click', () => vscode.postMessage({ type: 'generatePrompt' }));
      document.getElementById('copyPrompt').addEventListener('click', () => vscode.postMessage({ type: 'copyPrompt' }));
      target.addEventListener('change', () => vscode.postMessage({ type: 'setPromptOptions', target: target.value, style: style.value }));
      style.addEventListener('change', () => vscode.postMessage({ type: 'setPromptOptions', target: target.value, style: style.value }));
      nextStepButton.addEventListener('click', () => setStep(2));
      previousStepButton.addEventListener('click', () => setStep(1, { force: true }));
      ruleQuery.addEventListener('input', postFilters);
      componentQuery.addEventListener('input', postFilters);
      issuesBody.addEventListener('change', (event) => {
        const targetElement = event.target;
        if (!(targetElement instanceof HTMLInputElement) || targetElement.type !== 'checkbox') {
          return;
        }
        vscode.postMessage({ type: 'toggleIssue', key: targetElement.dataset.key });
      });
      document.addEventListener('click', (event) => {
        const targetElement = event.target;
        if (!(targetElement instanceof Element) || !targetElement.closest('.combo')) {
          closeAllCombos();
        }
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
