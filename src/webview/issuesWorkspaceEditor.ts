import * as vscode from 'vscode';
import { buildCanonicalPromptInput } from '../prompt/buildCanonicalPrompt';
import { renderPrompt } from '../prompt/renderPrompt';
import { PromptStyle, PromptTarget } from '../prompt/types';
import { SonarIssuesProvider } from '../providers/SonarIssuesProvider';
import { createSonarBackend } from '../sonar/SonarBackendFactory';
import { ConfigurationError } from '../util/errors';
import { FilterState } from '../state/FilterState';
import { ConnectionState } from '../state/ConnectionState';
import { SelectionState } from '../state/SelectionState';
import {
  IssueFilters,
  SonarCoverageTarget,
  SonarDuplicationTarget,
  SonarKpiSummary,
  SonarSecurityHotspot
} from '../sonar/types';
import { renderIssuesWorkspaceHtml } from './issuesWorkspaceEditor.html';

type WorkspaceMode = 'issues' | 'coverage' | 'duplication' | 'hotspots';
type CoverageFilters = { componentQuery?: string };
type DuplicationFilters = { componentQuery?: string };
type HotspotFilters = { componentQuery?: string; probabilities: string[] };

type IssuesWorkspaceMessage =
  | { type: 'setMode'; mode: WorkspaceMode }
  | { type: 'setFilters'; filters: { types: string[]; severities: string[]; statuses: string[]; ruleQuery?: string; componentQuery?: string } }
  | { type: 'setCoverageFilters'; filters: { componentQuery?: string } }
  | { type: 'setDuplicationFilters'; filters: { componentQuery?: string } }
  | { type: 'setHotspotFilters'; filters: { componentQuery?: string; probabilities: string[] } }
  | { type: 'toggleIssue'; key?: string }
  | { type: 'toggleCoverageTarget'; key?: string }
  | { type: 'toggleDuplicationTarget'; key?: string }
  | { type: 'toggleHotspot'; key?: string }
  | { type: 'selectVisible' }
  | { type: 'clearSelection' }
  | { type: 'clearFilters' }
  | { type: 'generatePrompt' }
  | { type: 'copyPrompt' }
  | { type: 'setPromptOptions'; target: PromptTarget; style: PromptStyle };

export class IssuesWorkspaceEditor {
  private panel?: vscode.WebviewPanel;
  private target: PromptTarget;
  private style: PromptStyle;
  private currentPrompt = '';
  private mode: WorkspaceMode = 'issues';
  private coverageTargets: SonarCoverageTarget[] = [];
  private duplicationTargets: SonarDuplicationTarget[] = [];
  private hotspots: SonarSecurityHotspot[] = [];
  private selectedCoverageKeys = new Set<string>();
  private selectedDuplicationKeys = new Set<string>();
  private selectedHotspotKeys = new Set<string>();
  private coverageFilters: CoverageFilters = {};
  private duplicationFilters: DuplicationFilters = {};
  private hotspotFilters: HotspotFilters = { probabilities: [] };
  private kpis: SonarKpiSummary = {};
  private supplementaryLoaded = false;

  public constructor(
    private readonly issuesProvider: SonarIssuesProvider,
    private readonly filterState: FilterState,
    private readonly selectionState: SelectionState,
    private readonly connectionState: ConnectionState
  ) {
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    this.target = config.get<PromptTarget>('prompt.defaultTarget', 'codex');
    this.style = config.get<PromptStyle>('prompt.defaultStyle', 'balanced');
  }

  public async open(mode?: WorkspaceMode): Promise<void> {
    if (mode) {
      this.mode = mode;
    }

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      this.update();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'sonarPromptFixer.issuesWorkspace',
      'Sonar Prompt Fixer Sonar Workspace',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (message: IssuesWorkspaceMessage) => {
      await this.handleMessage(message);
    });

    if (this.issuesProvider.getAllIssues().length === 0) {
      await this.issuesProvider.loadIssues();
    }
    if (!this.supplementaryLoaded) {
      await this.loadSupplementaryData();
    }

    this.panel.webview.html = renderIssuesWorkspaceHtml(this.panel.webview, this.buildPayload());
    this.update();
  }

  public async generatePrompt(): Promise<string> {
    const connection = this.connectionState.getConnection();
    const input = buildCanonicalPromptInput(this.getPromptSelection(), this.target, this.style, {
      type: connection.type,
      baseUrl: connection.baseUrl,
      projectKey: connection.projectKey,
      organization: connection.organization,
      branch: connection.branch,
      pullRequest: connection.pullRequest,
      verifyTls: connection.verifyTls,
      authMode: connection.authMode
    });
    this.currentPrompt = renderPrompt(input);
    this.update();
    return this.currentPrompt;
  }

  public getCurrentPrompt(): string {
    return this.currentPrompt;
  }

  public async reloadData(): Promise<void> {
    this.supplementaryLoaded = false;
    this.currentPrompt = '';

    if (!this.panel) {
      return;
    }

    await this.loadSupplementaryData();
    this.update();
  }

  public update(): void {
    if (!this.panel) {
      return;
    }

    const payload = this.buildPayload();
    if (!this.panel.webview.html) {
      this.panel.webview.html = renderIssuesWorkspaceHtml(this.panel.webview, payload);
    }
    this.panel.webview.postMessage(payload).then(undefined, () => undefined);
  }

  private buildPayload() {
    const visibleIssues = this.issuesProvider.getVisibleIssues();
    const selectedKeys = new Set(this.selectionState.getSelectedIssues().map((issue) => issue.key));
    const visibleCoverageTargets = this.getVisibleCoverageTargets();
    const visibleDuplicationTargets = this.getVisibleDuplicationTargets();
    const visibleHotspots = this.getVisibleHotspots();
    const connection = this.connectionState.getConnection();

    return {
      mode: this.mode,
      totalCount: this.getTotalCount(),
      modeSelectedCount: this.getModeSelectedCount(),
      visibleCount: this.getVisibleCount(visibleIssues, visibleCoverageTargets, visibleDuplicationTargets, visibleHotspots),
      selectedCount: this.getSelectedCount(),
      filters: this.filterState.getFilters(),
      coverageFilters: this.coverageFilters,
      duplicationFilters: this.duplicationFilters,
      hotspotFilters: this.hotspotFilters,
      target: this.target,
      style: this.style,
      prompt: this.currentPrompt,
      projectKey: connection.projectKey,
      kpis: this.kpis,
      issues: visibleIssues.map((issue) => ({
        ...issue,
        selected: selectedKeys.has(issue.key)
      })),
      coverageTargets: visibleCoverageTargets.map((target) => ({
        ...target,
        selected: this.selectedCoverageKeys.has(target.key)
      })),
      duplicationTargets: visibleDuplicationTargets.map((target) => ({
        ...target,
        selected: this.selectedDuplicationKeys.has(target.key)
      })),
      hotspots: visibleHotspots.map((hotspot) => ({
        ...hotspot,
        selected: this.selectedHotspotKeys.has(hotspot.key)
      }))
    };
  }

  private async handleMessage(message: IssuesWorkspaceMessage): Promise<void> {
    switch (message.type) {
      case 'setMode':
        this.mode = message.mode;
        this.update();
        break;
      case 'setFilters':
        this.applyFilters(message);
        break;
      case 'setCoverageFilters':
        this.coverageFilters = {
          componentQuery: message.filters.componentQuery?.trim() || undefined
        };
        this.update();
        break;
      case 'setDuplicationFilters':
        this.duplicationFilters = {
          componentQuery: message.filters.componentQuery?.trim() || undefined
        };
        this.update();
        break;
      case 'setHotspotFilters':
        this.hotspotFilters = {
          componentQuery: message.filters.componentQuery?.trim() || undefined,
          probabilities: [...message.filters.probabilities]
        };
        this.update();
        break;
      case 'toggleIssue':
        this.toggleIssue(message.key);
        break;
      case 'toggleCoverageTarget':
        this.toggleCoverageTarget(message.key);
        break;
      case 'toggleDuplicationTarget':
        this.toggleDuplicationTarget(message.key);
        break;
      case 'toggleHotspot':
        this.toggleHotspot(message.key);
        break;
      case 'selectVisible':
        this.selectVisible();
        break;
      case 'clearSelection':
        this.clearSelection();
        break;
      case 'clearFilters':
        this.clearFilters();
        break;
      case 'generatePrompt':
        await this.generatePrompt();
        break;
      case 'copyPrompt':
        await this.copyPrompt();
        break;
      case 'setPromptOptions':
        await this.setPromptOptions(message.target, message.style);
        this.update();
        break;
    }
  }

  private applyFilters(message: Extract<IssuesWorkspaceMessage, { type: 'setFilters' }>): void {
    this.filterState.setFilters({
      types: message.filters.types as IssueFilters['types'],
      severities: message.filters.severities as IssueFilters['severities'],
      statuses: message.filters.statuses,
      ruleQuery: message.filters.ruleQuery?.trim() || undefined,
      componentQuery: message.filters.componentQuery?.trim() || undefined
    });
  }

  private toggleIssue(issueKey?: string): void {
    if (!issueKey) {
      return;
    }

    const issue = this.issuesProvider.getAllIssues().find((candidate) => candidate.key === issueKey);
    if (issue) {
      this.selectionState.toggle(issue);
      this.update();
    }
  }

  private async copyPrompt(): Promise<void> {
    if (!this.currentPrompt) {
      await this.generatePrompt();
    }

    if (this.currentPrompt) {
      await vscode.env.clipboard.writeText(this.currentPrompt);
      await vscode.window.showInformationMessage('Prompt copied to clipboard.');
    }
  }

  private async setPromptOptions(target: PromptTarget, style: PromptStyle): Promise<void> {
    this.target = target;
    this.style = style;

    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    await Promise.all([
      config.update('prompt.defaultTarget', target, vscode.ConfigurationTarget.Global),
      config.update('prompt.defaultStyle', style, vscode.ConfigurationTarget.Global)
    ]);
  }

  private async loadSupplementaryData(): Promise<void> {
    try {
      const backend = createSonarBackend(this.connectionState.getConnection(), await this.connectionState.getToken());
      const [coverageTargets, duplicationTargets, hotspots, kpis] = await Promise.all([
        backend.getCoverageTargets(),
        backend.getDuplicationTargets(),
        backend.getSecurityHotspots(),
        backend.getKpiSummary()
      ]);

      this.coverageTargets = coverageTargets;
      this.duplicationTargets = duplicationTargets;
      this.hotspots = hotspots;
      this.kpis = kpis;
      this.selectedCoverageKeys = new Set(
        [...this.selectedCoverageKeys].filter((key) => coverageTargets.some((target) => target.key === key))
      );
      this.selectedDuplicationKeys = new Set(
        [...this.selectedDuplicationKeys].filter((key) => duplicationTargets.some((target) => target.key === key))
      );
      this.selectedHotspotKeys = new Set(
        [...this.selectedHotspotKeys].filter((key) => hotspots.some((hotspot) => hotspot.key === key))
      );
    } catch (error) {
      this.coverageTargets = [];
      this.duplicationTargets = [];
      this.hotspots = [];
      this.kpis = {};
      if (!(error instanceof ConfigurationError)) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to load Sonar workspace data.');
      }
    } finally {
      this.supplementaryLoaded = true;
    }
  }

  private getPromptSelection() {
    return {
      source: this.mode,
      issues: this.selectionState.getSelectedIssues(),
      coverageTargets: this.coverageTargets.filter((target) => this.selectedCoverageKeys.has(target.key)),
      duplicationTargets: this.duplicationTargets.filter((target) => this.selectedDuplicationKeys.has(target.key)),
      hotspots: this.hotspots.filter((hotspot) => this.selectedHotspotKeys.has(hotspot.key))
    };
  }

  private getVisibleCoverageTargets(): SonarCoverageTarget[] {
    const query = this.coverageFilters.componentQuery?.toLowerCase();
    return this.coverageTargets.filter((target) => {
      if (!query) {
        return true;
      }

      return target.path.toLowerCase().includes(query) || target.component.toLowerCase().includes(query);
    });
  }

  private getVisibleDuplicationTargets(): SonarDuplicationTarget[] {
    const query = this.duplicationFilters.componentQuery?.toLowerCase();
    return this.duplicationTargets.filter((target) => {
      if (!query) {
        return true;
      }

      return target.path.toLowerCase().includes(query) || target.component.toLowerCase().includes(query);
    });
  }

  private getVisibleHotspots(): SonarSecurityHotspot[] {
    const query = this.hotspotFilters.componentQuery?.toLowerCase();
    return this.hotspots.filter((hotspot) => {
      const matchesProbability = this.hotspotFilters.probabilities.length === 0 ||
        this.hotspotFilters.probabilities.includes(hotspot.vulnerabilityProbability ?? '');
      const matchesQuery = !query ||
        hotspot.component.toLowerCase().includes(query) ||
        hotspot.message.toLowerCase().includes(query);

      return matchesProbability && matchesQuery;
    });
  }

  private getTotalCount(): number {
    switch (this.mode) {
      case 'coverage':
        return this.coverageTargets.length;
      case 'duplication':
        return this.duplicationTargets.length;
      case 'hotspots':
        return this.hotspots.length;
      case 'issues':
      default:
        return this.issuesProvider.getAllIssues().length;
    }
  }

  private getVisibleCount(
    visibleIssues: ReturnType<SonarIssuesProvider['getVisibleIssues']>,
    visibleCoverageTargets: SonarCoverageTarget[],
    visibleDuplicationTargets: SonarDuplicationTarget[],
    visibleHotspots: SonarSecurityHotspot[]
  ): number {
    switch (this.mode) {
      case 'coverage':
        return visibleCoverageTargets.length;
      case 'duplication':
        return visibleDuplicationTargets.length;
      case 'hotspots':
        return visibleHotspots.length;
      case 'issues':
      default:
        return visibleIssues.length;
    }
  }

  private getSelectedCount(): number {
    return this.selectionState.getSelectedCount()
      + this.selectedCoverageKeys.size
      + this.selectedDuplicationKeys.size
      + this.selectedHotspotKeys.size;
  }

  private getModeSelectedCount(): number {
    switch (this.mode) {
      case 'coverage':
        return this.selectedCoverageKeys.size;
      case 'duplication':
        return this.selectedDuplicationKeys.size;
      case 'hotspots':
        return this.selectedHotspotKeys.size;
      case 'issues':
      default:
        return this.selectionState.getSelectedCount();
    }
  }

  private toggleCoverageTarget(key?: string): void {
    if (!key) {
      return;
    }

    if (this.selectedCoverageKeys.has(key)) {
      this.selectedCoverageKeys.delete(key);
    } else {
      this.selectedCoverageKeys.add(key);
    }
    this.update();
  }

  private toggleDuplicationTarget(key?: string): void {
    if (!key) {
      return;
    }

    if (this.selectedDuplicationKeys.has(key)) {
      this.selectedDuplicationKeys.delete(key);
    } else {
      this.selectedDuplicationKeys.add(key);
    }
    this.update();
  }

  private toggleHotspot(key?: string): void {
    if (!key) {
      return;
    }

    if (this.selectedHotspotKeys.has(key)) {
      this.selectedHotspotKeys.delete(key);
    } else {
      this.selectedHotspotKeys.add(key);
    }
    this.update();
  }

  private selectVisible(): void {
    switch (this.mode) {
      case 'coverage':
        for (const target of this.getVisibleCoverageTargets()) {
          this.selectedCoverageKeys.add(target.key);
        }
        this.update();
        break;
      case 'duplication':
        for (const target of this.getVisibleDuplicationTargets()) {
          this.selectedDuplicationKeys.add(target.key);
        }
        this.update();
        break;
      case 'hotspots':
        for (const hotspot of this.getVisibleHotspots()) {
          this.selectedHotspotKeys.add(hotspot.key);
        }
        this.update();
        break;
      case 'issues':
      default:
        this.selectionState.selectMany(this.issuesProvider.getVisibleIssues());
        this.update();
        break;
    }
  }

  private clearSelection(): void {
    switch (this.mode) {
      case 'coverage':
        this.selectedCoverageKeys.clear();
        this.update();
        break;
      case 'duplication':
        this.selectedDuplicationKeys.clear();
        this.update();
        break;
      case 'hotspots':
        this.selectedHotspotKeys.clear();
        this.update();
        break;
      case 'issues':
      default:
        this.selectionState.clear();
        this.update();
        break;
    }
  }

  private clearFilters(): void {
    switch (this.mode) {
      case 'coverage':
        this.coverageFilters = {};
        this.update();
        break;
      case 'duplication':
        this.duplicationFilters = {};
        this.update();
        break;
      case 'hotspots':
        this.hotspotFilters = { probabilities: [] };
        this.update();
        break;
      case 'issues':
      default:
        this.filterState.clear();
        break;
    }
  }
}
