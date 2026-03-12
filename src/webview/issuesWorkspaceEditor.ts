import * as vscode from 'vscode';
import { buildCanonicalPromptInput } from '../prompt/buildCanonicalPrompt';
import { renderPrompt } from '../prompt/renderPrompt';
import { PromptStyle, PromptTarget } from '../prompt/types';
import { SonarIssuesProvider } from '../providers/SonarIssuesProvider';
import { FilterState } from '../state/FilterState';
import { SelectionState } from '../state/SelectionState';
import { IssueFilters } from '../sonar/types';
import { renderIssuesWorkspaceHtml } from './issuesWorkspaceEditor.html';
import { ConfigurationEditor } from './configurationEditor';

type IssuesWorkspaceMessage =
  | { type: 'setFilters'; filters: { types: string[]; severities: string[]; statuses: string[]; ruleQuery?: string; componentQuery?: string } }
  | { type: 'toggleIssue'; key?: string }
  | { type: 'selectVisible' }
  | { type: 'clearSelection' }
  | { type: 'clearFilters' }
  | { type: 'refresh' }
  | { type: 'generatePrompt' }
  | { type: 'copyPrompt' }
  | { type: 'openConfig' }
  | { type: 'setPromptOptions'; target: PromptTarget; style: PromptStyle };

export class IssuesWorkspaceEditor {
  private panel?: vscode.WebviewPanel;
  private target: PromptTarget;
  private style: PromptStyle;
  private currentPrompt = '';

  public constructor(
    private readonly issuesProvider: SonarIssuesProvider,
    private readonly filterState: FilterState,
    private readonly selectionState: SelectionState,
    private readonly configurationEditor: ConfigurationEditor
  ) {
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    this.target = config.get<PromptTarget>('prompt.defaultTarget', 'codex');
    this.style = config.get<PromptStyle>('prompt.defaultStyle', 'balanced');
  }

  public async open(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      this.update();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'sonarPromptFixer.issuesWorkspace',
      'Sonar Prompt Fixer Issues',
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

    this.panel.webview.html = renderIssuesWorkspaceHtml(this.panel.webview, this.buildPayload());
    this.update();
  }

  public async generatePrompt(): Promise<string> {
    const selectedIssues = this.selectionState.getSelectedIssues();
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    const input = buildCanonicalPromptInput(selectedIssues, this.target, this.style, {
      type: config.get<'cloud' | 'server'>('connection.type', 'cloud'),
      baseUrl: config.get<string>('connection.baseUrl', 'https://sonarcloud.io'),
      projectKey: config.get<string>('connection.projectKey', ''),
      organization: config.get<string>('connection.organization', '') || undefined,
      branch: config.get<string>('connection.branch', '') || undefined,
      pullRequest: config.get<string>('connection.pullRequest', '') || undefined,
      verifyTls: config.get<boolean>('connection.verifyTls', true),
      authMode: config.get<'bearer' | 'basicToken'>('connection.authMode', 'bearer')
    });
    this.currentPrompt = renderPrompt(input);
    this.update();
    return this.currentPrompt;
  }

  public getCurrentPrompt(): string {
    return this.currentPrompt;
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
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');

    return {
      totalCount: this.issuesProvider.getAllIssues().length,
      visibleCount: visibleIssues.length,
      selectedCount: this.selectionState.getSelectedCount(),
      filters: this.filterState.getFilters(),
      target: this.target,
      style: this.style,
      prompt: this.currentPrompt,
      projectKey: config.get<string>('connection.projectKey', ''),
      issues: visibleIssues.map((issue) => ({
        ...issue,
        selected: selectedKeys.has(issue.key)
      }))
    };
  }

  private async handleMessage(message: IssuesWorkspaceMessage): Promise<void> {
    switch (message.type) {
      case 'setFilters':
        this.applyFilters(message);
        break;
      case 'toggleIssue':
        this.toggleIssue(message.key);
        break;
      case 'selectVisible':
        this.selectionState.selectMany(this.issuesProvider.getVisibleIssues());
        break;
      case 'clearSelection':
        this.selectionState.clear();
        break;
      case 'clearFilters':
        this.filterState.clear();
        break;
      case 'refresh':
        await this.issuesProvider.loadIssues();
        this.update();
        break;
      case 'generatePrompt':
        await this.generatePrompt();
        break;
      case 'copyPrompt':
        await this.copyPrompt();
        break;
      case 'openConfig':
        await this.configurationEditor.open();
        break;
      case 'setPromptOptions':
        this.target = message.target;
        this.style = message.style;
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
}
