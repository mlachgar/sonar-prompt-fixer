import { randomBytes } from 'node:crypto';
import {
  IssueFilters,
  SonarCoverageTarget,
  SonarDuplicationTarget,
  SonarIssue,
  SonarKpiSummary,
  SonarSecurityHotspot
} from '../sonar/types';
import { PromptStyle, PromptTarget } from '../prompt/types';

type WorkspaceMode = 'issues' | 'coverage' | 'duplication' | 'hotspots';

type IssuesWorkspaceModel = {
  mode: WorkspaceMode;
  selectedCount: number;
  visibleCount: number;
  totalCount: number;
  filters: IssueFilters;
  coverageFilters: { componentQuery?: string };
  duplicationFilters: { componentQuery?: string };
  hotspotFilters: { componentQuery?: string; probabilities: string[] };
  target: PromptTarget;
  style: PromptStyle;
  prompt: string;
  projectKey: string;
  kpis: SonarKpiSummary;
  issues: Array<SonarIssue & { selected: boolean }>;
  coverageTargets: Array<SonarCoverageTarget & { selected: boolean }>;
  duplicationTargets: Array<SonarDuplicationTarget & { selected: boolean }>;
  hotspots: Array<SonarSecurityHotspot & { selected: boolean }>;
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
    <title>Sonar Prompt Fixer Sonar Workspace</title>
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
      .hero { display: grid; gap: 14px; margin-bottom: 18px; }
      h1 { margin: 0; font-size: 32px; line-height: 1.05; }
      .lead { margin: 8px 0 0; color: var(--muted); }
      .modeBar, .stats, .kpis { display: flex; gap: 10px; flex-wrap: wrap; }
      .chip {
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel) 92%, white 4%);
        border-radius: 999px;
        padding: 8px 12px;
      }
      .modeButton {
        border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
        background: color-mix(in srgb, var(--panel) 92%, transparent);
      }
      .modeButton.active {
        background: color-mix(in srgb, var(--accent) 20%, var(--panel));
        color: var(--accentText);
      }
      .layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; align-items: start; flex: 1; min-height: 0; }
      .panel { border: 1px solid var(--border); background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, white 3%), var(--panel)); border-radius: 18px; overflow: hidden; }
      .toolbar, .filters, .promptToolbar { padding: 14px 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; border-bottom: 1px solid var(--border); }
      .filters {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        align-items: start;
      }
      .filterGroup {
        min-width: 0;
      }
      .filterGroup .filters {
        padding: 0;
        border-bottom: 0;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .filterGroup.compact .filters {
        grid-template-columns: repeat(auto-fit, minmax(180px, 260px));
      }
      .filterGroup.issueFilters .filters {
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      }
      .filters[hidden], .filterGroup[hidden], .stepPanel[hidden] { display: none; }
      label {
        display: grid;
        gap: 6px;
        font-size: 12px;
        color: var(--muted);
        min-width: 220px;
      }
      .filterGroup.compact label {
        min-width: 180px;
      }
      .filterGroup.issueFilters label {
        min-width: 190px;
      }
      input, select, button, textarea { font: inherit; }
      input, select, textarea {
        width: 100%;
        min-width: 0;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--vscode-input-background);
        color: var(--text);
        padding: 8px 10px;
      }
      button {
        border: 1px solid transparent;
        border-radius: 999px;
        padding: 8px 12px;
        cursor: pointer;
        background: color-mix(in srgb, var(--vscode-button-secondaryBackground) 82%, transparent);
        color: var(--text);
      }
      button:disabled { cursor: not-allowed; opacity: 0.65; }
      button.primary { background: var(--accent); color: var(--accentText); }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
      th { font-size: 12px; color: var(--muted); background: color-mix(in srgb, var(--panel) 96%, transparent); position: sticky; top: 0; }
      th.selectCol, td.selectCol {
        width: 58px;
        min-width: 58px;
        max-width: 58px;
        padding-left: 10px;
        padding-right: 6px;
      }
      td.selectCol input {
        display: block;
        margin: 0 auto;
      }
      .tableWrap { max-height: calc(100vh - 360px); overflow-y: auto; overflow-x: hidden; }
      .panelBody { padding: 0; }
      .message { min-width: 320px; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
      .severity, .type, .probability {
        display: inline-block;
        border-radius: 999px;
        padding: 3px 8px;
        font-size: 11px;
        border: 1px solid var(--border);
      }
      .empty { padding: 28px 16px; color: var(--muted); }
      .stepTitle { margin: 0; font-size: 16px; }
      .stepLead { margin: 4px 0 0; color: var(--muted); }
      .tableHint { padding: 10px 16px 14px; color: var(--muted); border-top: 1px solid var(--border); }
      .wrap { word-break: break-word; overflow-wrap: anywhere; }
      .comboLabel { position: relative; }
      .combo { position: relative; }
      .comboButton {
        width: 100%;
        min-width: 0;
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
      .stepToolbar {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border);
      }
      .stepNav { display: flex; gap: 10px; flex-wrap: wrap; }
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
      .stepNav button:disabled { opacity: 0.5; box-shadow: none; }
      .promptPanel { min-height: calc(100vh - 200px); display: flex; flex-direction: column; }
      .promptToolbar { justify-content: space-between; }
      .promptActions { display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
      .promptBox { position: relative; display: flex; flex-direction: column; min-height: 0; }
      .iconButton {
        width: 34px;
        height: 34px;
        padding: 0;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .copyPromptButton { position: absolute; top: 12px; right: 12px; z-index: 1; }
      .copyPromptButton svg { width: 16px; height: 16px; fill: currentColor; }
      .promptPanel textarea {
        min-height: 420px;
        height: 100%;
        flex: 1;
        resize: vertical;
        border: 0;
        border-radius: 0;
        background: transparent;
        padding-top: 44px;
      }
      .promptPanel .panelBody { padding: 0 0 10px; flex: 1; min-height: 0; }
      @media (max-width: 1250px) {
        .promptPanel { min-height: calc(100vh - 170px); }
        .promptPanel textarea { min-height: 260px; }
      }
      @media (max-width: 1100px) { .filters, .filterGroup .filters { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); } }
      @media (max-width: 700px) {
        .hero { gap: 12px; }
        .filters, .filterGroup .filters { grid-template-columns: 1fr; }
        label { min-width: 0; }
        .stepToolbar { flex-direction: column; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div>
          <h1>Sonar Workspace</h1>
          <p class="lead">Switch between Sonar issues, coverage gaps, duplication targets, and security hotspots to generate focused remediation prompts.</p>
        </div>
        <div class="modeBar">
          <button type="button" class="modeButton" id="issuesMode">Issues</button>
          <button type="button" class="modeButton" id="coverageMode">Coverage</button>
          <button type="button" class="modeButton" id="duplicationMode">Duplication</button>
          <button type="button" class="modeButton" id="hotspotsMode">Security Hotspots</button>
        </div>
        <div class="stats">
          <div class="chip" id="totalCount"></div>
          <div class="chip" id="visibleCount"></div>
          <div class="chip" id="selectedCount"></div>
        </div>
        <div class="kpis" id="kpiStats"></div>
      </section>

      <section class="layout">
        <section class="panel stepPanel" id="selectionPanel">
          <div class="stepToolbar">
            <div>
              <h2 class="stepTitle" id="step1Title">Step 1: Select issues</h2>
              <p class="stepLead" id="step1Lead">Filter the list and choose the findings to include in the generated remediation prompt.</p>
            </div>
            <div class="stepNav">
              <button type="button" id="nextStep">Generate Prompt</button>
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
            <div class="filterGroup issueFilters" id="issueFilters">
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
                  <input id="issueComponentQuery" type="text" placeholder="src/app" />
                </label>
              </div>
            </div>

            <div class="filterGroup compact" id="coverageFilters" hidden>
              <div class="filters">
                <label>File contains
                  <input id="coverageComponentQuery" type="text" placeholder="src/" />
                </label>
              </div>
            </div>

            <div class="filterGroup compact" id="duplicationFilters" hidden>
              <div class="filters">
                <label>File contains
                  <input id="duplicationComponentQuery" type="text" placeholder="src/" />
                </label>
              </div>
            </div>

            <div class="filterGroup compact" id="hotspotFilters" hidden>
              <div class="filters">
                <label class="comboLabel">Probability
                  <div class="combo" id="probabilitiesCombo">
                    <button type="button" class="comboButton" id="probabilitiesButton"></button>
                    <div class="comboMenu" id="probabilitiesMenu"></div>
                  </div>
                </label>
                <label>File or message contains
                  <input id="hotspotComponentQuery" type="text" placeholder="auth, src/" />
                </label>
              </div>
            </div>
          </div>
          <div class="tableWrap">
            <table>
              <thead id="tableHead"></thead>
              <tbody id="tableBody"></tbody>
            </table>
          <div class="empty" id="emptyState" hidden></div>
          </div>
          <div class="tableHint" id="tableHint"></div>
        </section>

        <section class="panel promptPanel stepPanel" id="promptPanel" hidden>
          <div class="stepToolbar">
            <div>
              <h2 class="stepTitle">Step 2: Generate the prompt</h2>
              <p class="stepLead" id="step2Lead">Generate a focused prompt for the current selection.</p>
            </div>
            <div class="stepNav">
              <button type="button" id="previousStep">Edit Selection</button>
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
              <button class="primary" id="generatePrompt">Re-Generate Prompt</button>
            </div>
          </div>
          <div class="panelBody promptBox">
            <button id="copyPrompt" class="iconButton copyPromptButton" title="Copy prompt" aria-label="Copy prompt">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"/>
              </svg>
            </button>
            <textarea id="prompt" readonly placeholder="Select items and generate a prompt."></textarea>
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
      const kpiStats = document.getElementById('kpiStats');
      const tableHead = document.getElementById('tableHead');
      const tableBody = document.getElementById('tableBody');
      const emptyState = document.getElementById('emptyState');
      const tableHint = document.getElementById('tableHint');
      const promptPanel = document.getElementById('promptPanel');
      const selectionPanel = document.getElementById('selectionPanel');
      const prompt = document.getElementById('prompt');
      const target = document.getElementById('target');
      const style = document.getElementById('style');
      const generatePromptButton = document.getElementById('generatePrompt');
      const copyPromptButton = document.getElementById('copyPrompt');
      const nextStepButton = document.getElementById('nextStep');
      const previousStepButton = document.getElementById('previousStep');
      const step1Title = document.getElementById('step1Title');
      const step1Lead = document.getElementById('step1Lead');
      const step2Lead = document.getElementById('step2Lead');
      const issueFilters = document.getElementById('issueFilters');
      const coverageFilters = document.getElementById('coverageFilters');
      const duplicationFilters = document.getElementById('duplicationFilters');
      const hotspotFilters = document.getElementById('hotspotFilters');
      const ruleQuery = document.getElementById('ruleQuery');
      const issueComponentQuery = document.getElementById('issueComponentQuery');
      const coverageComponentQuery = document.getElementById('coverageComponentQuery');
      const duplicationComponentQuery = document.getElementById('duplicationComponentQuery');
      const hotspotComponentQuery = document.getElementById('hotspotComponentQuery');
      const modeButtons = {
        issues: document.getElementById('issuesMode'),
        coverage: document.getElementById('coverageMode'),
        duplication: document.getElementById('duplicationMode'),
        hotspots: document.getElementById('hotspotsMode')
      };
      const comboConfigs = [
        { key: 'types', values: ['BUG', 'VULNERABILITY', 'CODE_SMELL'] },
        { key: 'severities', values: ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'] },
        { key: 'statuses', values: ['OPEN', 'CONFIRMED', 'REOPENED', 'RESOLVED', 'ACCEPTED', 'FALSE-POSITIVE'] },
        { key: 'probabilities', values: ['HIGH', 'MEDIUM', 'LOW'] }
      ];
      const comboState = Object.fromEntries(comboConfigs.map((config) => [config.key, []]));
      let currentStep = 1;
      let currentMode = model.mode;

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
            postCurrentFilters();
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
        const showSelection = step === 1;
        selectionPanel.hidden = !showSelection;
        promptPanel.hidden = showSelection;
      }

      function postCurrentFilters() {
        if (currentMode === 'issues') {
          vscode.postMessage({
            type: 'setFilters',
            filters: {
              types: comboState.types,
              severities: comboState.severities,
              statuses: comboState.statuses,
              ruleQuery: ruleQuery.value.trim(),
              componentQuery: issueComponentQuery.value.trim()
            }
          });
          return;
        }

        if (currentMode === 'coverage') {
          vscode.postMessage({
            type: 'setCoverageFilters',
            filters: {
              componentQuery: coverageComponentQuery.value.trim()
            }
          });
          return;
        }

        if (currentMode === 'duplication') {
          vscode.postMessage({
            type: 'setDuplicationFilters',
            filters: {
              componentQuery: duplicationComponentQuery.value.trim()
            }
          });
          return;
        }

        vscode.postMessage({
          type: 'setHotspotFilters',
          filters: {
            componentQuery: hotspotComponentQuery.value.trim(),
            probabilities: comboState.probabilities
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

      function renderTable(data) {
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        if (data.mode === 'coverage') {
          tableHead.innerHTML = '<tr><th class="selectCol">Select</th><th>File</th><th>Coverage</th><th>Line Coverage</th><th>Branch Coverage</th><th>Uncovered Lines</th><th>Uncovered Branches</th></tr>';
          for (const target of data.coverageTargets) {
            const row = document.createElement('tr');
            row.innerHTML = [
              '<td class="selectCol"><input type="checkbox" data-mode="coverage" data-key="' + target.key + '"' + (target.selected ? ' checked' : '') + ' /></td>',
              '<td class="mono wrap">' + escapeHtml(target.path) + '</td>',
              '<td>' + formatPercent(target.coverage) + '</td>',
              '<td>' + formatPercent(target.lineCoverage) + '</td>',
              '<td>' + formatPercent(target.branchCoverage) + '</td>',
              '<td>' + formatNumber(target.uncoveredLines) + '</td>',
              '<td>' + formatNumber(target.uncoveredConditions) + '</td>'
            ].join('');
            tableBody.appendChild(row);
          }
          emptyState.textContent = 'No uncovered files match the current filters.';
          emptyState.hidden = data.coverageTargets.length > 0;
          return;
        }

        if (data.mode === 'duplication') {
          tableHead.innerHTML = '<tr><th class="selectCol">Select</th><th>File</th><th>Duplication</th><th>Duplicated Lines</th><th>Duplicated Blocks</th></tr>';
          for (const target of data.duplicationTargets) {
            const row = document.createElement('tr');
            row.innerHTML = [
              '<td class="selectCol"><input type="checkbox" data-mode="duplication" data-key="' + target.key + '"' + (target.selected ? ' checked' : '') + ' /></td>',
              '<td class="mono wrap">' + escapeHtml(target.path) + '</td>',
              '<td>' + formatPercent(target.duplicatedLinesDensity) + '</td>',
              '<td>' + formatNumber(target.duplicatedLines) + '</td>',
              '<td>' + formatNumber(target.duplicatedBlocks) + '</td>'
            ].join('');
            tableBody.appendChild(row);
          }
          emptyState.textContent = 'No duplication targets match the current filters.';
          emptyState.hidden = data.duplicationTargets.length > 0;
          return;
        }

        if (data.mode === 'hotspots') {
          tableHead.innerHTML = '<tr><th class="selectCol">Select</th><th>Probability</th><th>Status</th><th>Location</th><th class="message">Message</th></tr>';
          for (const hotspot of data.hotspots) {
            const row = document.createElement('tr');
            const locationBase = toRelativeComponent(hotspot.component, data.projectKey);
            const location = hotspot.line ? locationBase + ':' + hotspot.line : locationBase;
            row.innerHTML = [
              '<td class="selectCol"><input type="checkbox" data-mode="hotspots" data-key="' + hotspot.key + '"' + (hotspot.selected ? ' checked' : '') + ' /></td>',
              '<td><span class="probability">' + escapeHtml(hotspot.vulnerabilityProbability || 'UNKNOWN') + '</span></td>',
              '<td>' + escapeHtml(hotspot.status || 'TO_REVIEW') + '</td>',
              '<td class="mono wrap">' + escapeHtml(location) + '</td>',
              '<td class="message wrap">' + escapeHtml(hotspot.message) + '</td>'
            ].join('');
            tableBody.appendChild(row);
          }
          emptyState.textContent = 'No security hotspots match the current filters.';
          emptyState.hidden = data.hotspots.length > 0;
          return;
        }

        tableHead.innerHTML = '<tr><th class="selectCol">Select</th><th>Severity</th><th>Type</th><th>Status</th><th>Rule</th><th>Location</th><th class="message">Message</th></tr>';
        for (const issue of data.issues) {
          const row = document.createElement('tr');
          const locationBase = toRelativeComponent(issue.component, data.projectKey);
          const location = issue.line ? locationBase + ':' + issue.line : locationBase;
          row.innerHTML = [
            '<td class="selectCol"><input type="checkbox" data-mode="issues" data-key="' + issue.key + '"' + (issue.selected ? ' checked' : '') + ' /></td>',
            '<td><span class="severity">' + issue.severity + '</span></td>',
            '<td><span class="type">' + issue.type + '</span></td>',
            '<td class="wrap">' + escapeHtml(issue.status || 'OPEN') + '</td>',
            '<td class="mono wrap">' + escapeHtml(issue.rule) + '</td>',
            '<td class="mono wrap">' + escapeHtml(location) + '</td>',
            '<td class="message wrap">' + escapeHtml(issue.message) + '</td>'
          ].join('');
          tableBody.appendChild(row);
        }
        emptyState.textContent = data.totalCount === 0
          ? 'No open issues were found for this project. Refresh after a new Sonar analysis if you expect results.'
          : 'No issues match the current filters.';
        emptyState.hidden = data.issues.length > 0;
      }

      function renderKpis(data) {
        const chips = [
          ['Coverage', formatPercent(data.kpis.coverage)],
          ['Line Coverage', formatPercent(data.kpis.lineCoverage)],
          ['Branch Coverage', formatPercent(data.kpis.branchCoverage)],
          ['Duplication', formatPercent(data.kpis.duplicationDensity)],
          ['Dup. Lines', formatNumber(data.kpis.duplicatedLines)],
          ['Hotspots', formatNumber(data.kpis.securityHotspots)],
          ['Reviewed', formatPercent(data.kpis.securityHotspotsReviewed)],
          ['Review Rating', data.kpis.securityReviewRating || 'n/a']
        ];

        kpiStats.innerHTML = chips
          .map(([label, value]) => '<div class="chip">' + escapeHtml(label) + ': ' + escapeHtml(String(value)) + '</div>')
          .join('');
      }

      function updateModeText(mode) {
        if (mode === 'coverage') {
          step1Title.textContent = 'Step 1: Select coverage targets';
          step1Lead.textContent = 'Choose the uncovered files you want the prompt to target for new or updated tests.';
          step2Lead.textContent = 'Generate a test-focused prompt for the selected coverage gaps.';
          tableHint.textContent = currentTotalCount === 0
            ? ''
            : currentSelectionCount > 0
              ? 'Coverage targets selected. Continue to step 2 to generate a test prompt.'
              : 'Select one or more coverage targets to unlock step 2.';
          return;
        }

        if (mode === 'duplication') {
          step1Title.textContent = 'Step 1: Select duplication targets';
          step1Lead.textContent = 'Choose the duplicated files you want the prompt to refactor safely.';
          step2Lead.textContent = 'Generate a duplication-focused prompt for the selected files.';
          tableHint.textContent = currentTotalCount === 0
            ? ''
            : currentSelectionCount > 0
              ? 'Duplication targets selected. Continue to step 2 to generate a refactoring prompt.'
              : 'Select one or more duplication targets to unlock step 2.';
          return;
        }

        if (mode === 'hotspots') {
          step1Title.textContent = 'Step 1: Select security hotspots';
          step1Lead.textContent = 'Choose the hotspots you want the prompt to review and remediate.';
          step2Lead.textContent = 'Generate a security-focused prompt for the selected hotspots.';
          tableHint.textContent = currentTotalCount === 0
            ? ''
            : currentSelectionCount > 0
              ? 'Security hotspots selected. Continue to step 2 to generate a remediation prompt.'
              : 'Select one or more hotspots to unlock step 2.';
          return;
        }

        step1Title.textContent = 'Step 1: Select issues';
        step1Lead.textContent = 'Filter the list and choose the findings to include in the generated remediation prompt.';
        step2Lead.textContent = 'Generate a focused remediation prompt for the current selection.';
        tableHint.textContent = currentTotalCount === 0
          ? ''
          : currentSelectionCount > 0
            ? 'Selection ready. Continue to step 2 to generate the prompt.'
            : 'Select one or more issues to unlock step 2.';
      }

      function escapeHtml(value) {
        return value
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;');
      }

      function formatPercent(value) {
        return value === undefined || value === null ? 'n/a' : value + '%';
      }

      function formatNumber(value) {
        return value === undefined || value === null ? 'n/a' : String(value);
      }

      let currentSelectionCount = model.selectedCount;
      let currentTotalCount = model.totalCount;
      for (const config of comboConfigs) {
        createCombo(config);
      }

      function render(data) {
        currentMode = data.mode;
        currentSelectionCount = data.selectedCount;
        currentTotalCount = data.totalCount;
        totalCount.textContent = data.totalCount + ' total';
        visibleCount.textContent = data.visibleCount + ' visible';
        selectedCount.textContent = data.selectedCount + ' selected';
        renderKpis(data);

        modeButtons.issues.classList.toggle('active', data.mode === 'issues');
        modeButtons.coverage.classList.toggle('active', data.mode === 'coverage');
        modeButtons.duplication.classList.toggle('active', data.mode === 'duplication');
        modeButtons.hotspots.classList.toggle('active', data.mode === 'hotspots');
        issueFilters.hidden = data.mode !== 'issues';
        coverageFilters.hidden = data.mode !== 'coverage';
        duplicationFilters.hidden = data.mode !== 'duplication';
        hotspotFilters.hidden = data.mode !== 'hotspots';

        applyComboSelection('types', data.filters.types || []);
        applyComboSelection('severities', data.filters.severities || []);
        applyComboSelection('statuses', data.filters.statuses || []);
        applyComboSelection('probabilities', data.hotspotFilters.probabilities || []);
        syncTextInput(ruleQuery, data.filters.ruleQuery || '');
        syncTextInput(issueComponentQuery, data.filters.componentQuery || '');
        syncTextInput(coverageComponentQuery, data.coverageFilters.componentQuery || '');
        syncTextInput(duplicationComponentQuery, data.duplicationFilters.componentQuery || '');
        syncTextInput(hotspotComponentQuery, data.hotspotFilters.componentQuery || '');
        target.value = data.target;
        style.value = data.style;
        prompt.value = data.prompt || '';
        nextStepButton.disabled = data.selectedCount === 0;
        generatePromptButton.disabled = data.selectedCount === 0;
        copyPromptButton.disabled = !data.prompt;
        updateModeText(data.mode);
        renderTable(data);

        if (data.selectedCount === 0 && currentStep === 2) {
          setStep(1, { force: true });
        } else {
          setStep(currentStep, { force: true });
        }
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
      nextStepButton.addEventListener('click', () => {
        if (nextStepButton.disabled) {
          return;
        }

        vscode.postMessage({ type: 'setPromptOptions', target: target.value, style: style.value });
        vscode.postMessage({ type: 'generatePrompt' });
        setStep(2, { force: true });
      });
      previousStepButton.addEventListener('click', () => setStep(1, { force: true }));
      modeButtons.issues.addEventListener('click', () => vscode.postMessage({ type: 'setMode', mode: 'issues' }));
      modeButtons.coverage.addEventListener('click', () => vscode.postMessage({ type: 'setMode', mode: 'coverage' }));
      modeButtons.duplication.addEventListener('click', () => vscode.postMessage({ type: 'setMode', mode: 'duplication' }));
      modeButtons.hotspots.addEventListener('click', () => vscode.postMessage({ type: 'setMode', mode: 'hotspots' }));
      ruleQuery.addEventListener('input', postCurrentFilters);
      issueComponentQuery.addEventListener('input', postCurrentFilters);
      coverageComponentQuery.addEventListener('input', postCurrentFilters);
      duplicationComponentQuery.addEventListener('input', postCurrentFilters);
      hotspotComponentQuery.addEventListener('input', postCurrentFilters);
      tableBody.addEventListener('change', (event) => {
        const targetElement = event.target;
        if (!(targetElement instanceof HTMLInputElement) || targetElement.type !== 'checkbox') {
          return;
        }

        const rowMode = targetElement.dataset.mode;
        if (rowMode === 'coverage') {
          vscode.postMessage({ type: 'toggleCoverageTarget', key: targetElement.dataset.key });
          return;
        }

        if (rowMode === 'duplication') {
          vscode.postMessage({ type: 'toggleDuplicationTarget', key: targetElement.dataset.key });
          return;
        }

        if (rowMode === 'hotspots') {
          vscode.postMessage({ type: 'toggleHotspot', key: targetElement.dataset.key });
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
  return randomBytes(18).toString('base64url');
}
