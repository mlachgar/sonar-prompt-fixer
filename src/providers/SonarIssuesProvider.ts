import * as vscode from 'vscode';
import { createSonarBackend } from '../sonar/SonarBackendFactory';
import { SonarIssue } from '../sonar/types';
import { ConnectionState } from '../state/ConnectionState';
import { FilterState } from '../state/FilterState';
import { SelectionState } from '../state/SelectionState';
import { ConfigurationError } from '../util/errors';

type GroupKey = 'severity' | 'type';

export class SonarIssuesProvider implements vscode.TreeDataProvider<IssueTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<IssueTreeItem | undefined>();
  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  private readonly onDidChangeIssuesEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeIssues = this.onDidChangeIssuesEmitter.event;
  private issues: SonarIssue[] = [];
  private visibleIssues: SonarIssue[] = [];

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly connectionState: ConnectionState,
    private readonly filterState: FilterState,
    private readonly selectionState: SelectionState
  ) {}

  public getTreeItem(element: IssueTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: IssueTreeItem): Promise<IssueTreeItem[]> {
    if (!element) {
      return this.getRootItems();
    }

    return [];
  }

  public refresh(): void {
    this.visibleIssues = this.filterState.apply(this.issues);
    this.onDidChangeTreeDataEmitter.fire(undefined);
    this.onDidChangeIssuesEmitter.fire();
  }

  public notifyViewChanged(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
    this.onDidChangeIssuesEmitter.fire();
  }

  public getVisibleIssues(): SonarIssue[] {
    return [...this.visibleIssues];
  }

  public getAllIssues(): SonarIssue[] {
    return [...this.issues];
  }

  public async loadIssues(): Promise<void> {
    try {
      const backend = createSonarBackend(this.connectionState.getConnection(), await this.connectionState.getToken());
      this.issues = await backend.getIssues(this.filterState.getFilters());
      this.selectionState.setKnownIssues(this.issues);
      this.visibleIssues = this.filterState.apply(this.issues);
    } catch (error) {
      this.issues = [];
      this.visibleIssues = [];
      if (!(error instanceof ConfigurationError)) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to load Sonar issues.');
      }
    } finally {
      this.onDidChangeTreeDataEmitter.fire(undefined);
      this.onDidChangeIssuesEmitter.fire();
    }
  }

  private async getRootItems(): Promise<IssueTreeItem[]> {
    if (this.issues.length === 0 && this.visibleIssues.length === 0) {
      await this.loadIssues();
    }

    if (this.visibleIssues.length === 0) {
      return [new IssueTreeItem('openWorkspace', 'Open Issues Workspace', vscode.TreeItemCollapsibleState.None), new IssueTreeItem('empty', 'No issues to display', vscode.TreeItemCollapsibleState.None, undefined, [])];
    }

    const groupBy = vscode.workspace.getConfiguration('sonarPromptFixer').get<GroupKey>('groupBy', 'severity');
    const groups = new Map<string, SonarIssue[]>();
    for (const issue of this.visibleIssues) {
      const key = groupBy === 'severity' ? issue.severity : issue.type;
      const current = groups.get(key) ?? [];
      current.push(issue);
      groups.set(key, current);
    }

    return [
      new IssueTreeItem('openWorkspace', `Open Issues Workspace`, vscode.TreeItemCollapsibleState.None),
      new IssueTreeItem('summary', `${this.selectionState.getSelectedCount()} selected • ${this.visibleIssues.length} visible`, vscode.TreeItemCollapsibleState.None),
      ...[...groups.entries()]
      .sort((left, right) => right[1].length - left[1].length)
      .map(([label, issues]) => new IssueTreeItem('group', `${label} (${issues.length})`, vscode.TreeItemCollapsibleState.None, undefined, issues, label))
    ];
  }
}

class IssueTreeItem extends vscode.TreeItem {
  public constructor(
    public readonly kind: 'group' | 'empty' | 'openWorkspace' | 'summary',
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly issue?: SonarIssue,
    public readonly issues: SonarIssue[] = [],
    groupLabel?: string
  ) {
    super(label, collapsibleState);
    this.contextValue = getContextValue(kind);
    if (kind === 'group') {
      this.description = `${issues.filter((candidate) => candidate.status !== 'RESOLVED').length} active`;
      this.command = {
        command: 'sonarPromptFixer.openIssuesWorkspace',
        title: 'Open Issues Workspace'
      };
      this.iconPath = new vscode.ThemeIcon('folder-library');
    } else if (kind === 'openWorkspace') {
      this.command = {
        command: 'sonarPromptFixer.openIssuesWorkspace',
        title: 'Open Issues Workspace'
      };
      this.iconPath = new vscode.ThemeIcon('layout');
    } else if (kind === 'summary') {
      this.iconPath = new vscode.ThemeIcon('graph');
    } else if (kind === 'empty') {
      this.iconPath = new vscode.ThemeIcon('info');
    }
  }
}

function getContextValue(kind: IssueTreeItem['kind']): string {
  if (kind === 'group') {
    return 'sonarGroup';
  }

  if (kind === 'openWorkspace') {
    return 'sonarOpenWorkspace';
  }

  if (kind === 'summary') {
    return 'sonarSummary';
  }

  return 'sonarEmpty';
}
