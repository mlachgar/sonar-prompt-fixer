import * as vscode from 'vscode';
import { createSonarBackend } from '../sonar/SonarBackendFactory';
import {
  SonarCoverageTarget,
  SonarDuplicationTarget,
  SonarIssue,
  SonarSecurityHotspot
} from '../sonar/types';
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
  private coverageTargets: SonarCoverageTarget[] = [];
  private duplicationTargets: SonarDuplicationTarget[] = [];
  private hotspots: SonarSecurityHotspot[] = [];
  private lastLoadWarnings: string[] = [];
  private hasLoadedFindings = false;
  private loadingFindings?: Promise<void>;

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

    return this.getChildrenForGroup(element);
  }

  public refresh(): void {
    this.visibleIssues = this.filterState.apply(this.issues);
    this.onDidChangeIssuesEmitter.fire();
  }

  public getVisibleIssues(): SonarIssue[] {
    return [...this.visibleIssues];
  }

  public getAllIssues(): SonarIssue[] {
    return [...this.issues];
  }

  public getCoverageTargets(): SonarCoverageTarget[] {
    return [...this.coverageTargets];
  }

  public getDuplicationTargets(): SonarDuplicationTarget[] {
    return [...this.duplicationTargets];
  }

  public getHotspots(): SonarSecurityHotspot[] {
    return [...this.hotspots];
  }

  public isLoading(): boolean {
    return this.loadingFindings !== undefined;
  }

  public hasLoadedData(): boolean {
    return this.hasLoadedFindings;
  }

  public getLastLoadWarnings(): string[] {
    return [...this.lastLoadWarnings];
  }

  public async loadIssues(): Promise<void> {
    return this.loadFindings();
  }

  public async reloadFindings(): Promise<void> {
    if (this.loadingFindings) {
      await this.loadingFindings;
    }

    this.resetFindings();
    this.hasLoadedFindings = false;
    this.onDidChangeTreeDataEmitter.fire(undefined);
    this.onDidChangeIssuesEmitter.fire();
    return this.loadFindings();
  }

  public async loadFindings(): Promise<void> {
    if (this.loadingFindings) {
      return this.loadingFindings;
    }

    this.loadingFindings = (async () => {
      try {
        const backend = createSonarBackend(this.connectionState.getConnection(), await this.connectionState.getToken());
        const [issuesResult, coverageResult, duplicationResult, hotspotsResult] = await Promise.allSettled([
          backend.getIssues(this.filterState.getFilters()),
          backend.getCoverageTargets(),
          backend.getDuplicationTargets(),
          backend.getSecurityHotspots()
        ]);

        this.lastLoadWarnings = [];
        this.issues = unwrapResult(issuesResult, 'Issues', this.lastLoadWarnings);
        this.coverageTargets = unwrapResult(coverageResult, 'Coverage', this.lastLoadWarnings);
        this.duplicationTargets = unwrapResult(duplicationResult, 'Duplication', this.lastLoadWarnings);
        this.hotspots = unwrapResult(hotspotsResult, 'Security Hotspots', this.lastLoadWarnings);
        this.selectionState.setKnownIssues(this.issues);
        this.visibleIssues = this.filterState.apply(this.issues);

        for (const warning of this.lastLoadWarnings) {
          void vscode.window.showWarningMessage(warning);
        }
      } catch (error) {
        this.issues = [];
        this.coverageTargets = [];
        this.duplicationTargets = [];
        this.hotspots = [];
        this.visibleIssues = [];
        this.lastLoadWarnings = [];
        if (!(error instanceof ConfigurationError)) {
          void vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to load Sonar findings.');
        }
      } finally {
        this.hasLoadedFindings = true;
        this.loadingFindings = undefined;
        this.onDidChangeTreeDataEmitter.fire(undefined);
        this.onDidChangeIssuesEmitter.fire();
      }
    })();

    return this.loadingFindings;
  }

  private resetFindings(): void {
    this.issues = [];
    this.visibleIssues = [];
    this.coverageTargets = [];
    this.duplicationTargets = [];
    this.hotspots = [];
    this.lastLoadWarnings = [];
    this.selectionState.setKnownIssues([]);
  }

  private async getRootItems(): Promise<IssueTreeItem[]> {
    if (!this.hasLoadedFindings) {
      await this.loadFindings();
    }

    const rootItems: IssueTreeItem[] = [];

    if (
      this.issues.length === 0 &&
      this.coverageTargets.length === 0 &&
      this.duplicationTargets.length === 0 &&
      this.hotspots.length === 0
    ) {
      rootItems.push(new IssueTreeItem('empty', 'No findings to display', vscode.TreeItemCollapsibleState.None, undefined, []));
      return rootItems;
    }

    if (this.issues.length > 0) {
      rootItems.push(new IssueTreeItem('issuesGroup', `Issues (${this.issues.length})`, vscode.TreeItemCollapsibleState.Collapsed));
    }
    if (this.coverageTargets.length > 0) {
      rootItems.push(new IssueTreeItem('coverageGroup', `Coverage (${this.coverageTargets.length})`, vscode.TreeItemCollapsibleState.Collapsed));
    }
    if (this.duplicationTargets.length > 0) {
      rootItems.push(new IssueTreeItem('duplicationGroup', `Duplication (${this.duplicationTargets.length})`, vscode.TreeItemCollapsibleState.Collapsed));
    }
    if (this.hotspots.length > 0) {
      rootItems.push(new IssueTreeItem('hotspotsGroup', `Security Hotspots (${this.hotspots.length})`, vscode.TreeItemCollapsibleState.Collapsed));
    }

    return rootItems;
  }

  public async getChildrenForGroup(element: IssueTreeItem): Promise<IssueTreeItem[]> {
      switch (element.kind) {
      case 'issuesGroup':
        return this.getIssueSeverityGroups();
      case 'issueSeverityGroup':
        return this.getIssueItems(element.itemLabel);
      case 'coverageGroup':
        return this.coverageTargets.map((target) => {
          const description = `${formatPercent(target.coverage)} coverage`;
          return new IssueTreeItem('coverage', target.path, vscode.TreeItemCollapsibleState.None, undefined, [], description);
        });
      case 'duplicationGroup':
        return this.duplicationTargets.map((target) => {
          const description = `${formatPercent(target.duplicatedLinesDensity)} duplicated`;
          return new IssueTreeItem('duplication', target.path, vscode.TreeItemCollapsibleState.None, undefined, [], description);
        });
      case 'hotspotsGroup':
        return this.getHotspotProbabilityGroups();
      case 'hotspotProbabilityGroup':
        return this.getHotspotItems(element.itemLabel);
      case 'issue':
      case 'coverage':
      case 'duplication':
      case 'hotspot':
      case 'empty':
      default:
        return [];
    }
  }

  private getIssueSeverityGroups(): IssueTreeItem[] {
    const severityOrder = ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'];
    const counts = new Map<string, number>();

    for (const issue of this.issues) {
      counts.set(issue.severity, (counts.get(issue.severity) ?? 0) + 1);
    }

    return severityOrder
      .filter((severity) => counts.has(severity))
      .map((severity) => new IssueTreeItem('issueSeverityGroup', severity, vscode.TreeItemCollapsibleState.Collapsed, undefined, [], `${counts.get(severity)} issues`));
  }

  private getIssueItems(severity?: string): IssueTreeItem[] {
    return this.issues
      .filter((issue) => !severity || issue.severity === severity)
      .sort((left, right) => left.rule.localeCompare(right.rule))
      .map((issue) => {
        const location = issue.line ? `${issue.component}:${issue.line}` : issue.component;
        return new IssueTreeItem('issue', issue.rule, vscode.TreeItemCollapsibleState.None, issue, [], location);
      });
  }

  private getHotspotProbabilityGroups(): IssueTreeItem[] {
    const probabilityOrder = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
    const counts = new Map<string, number>();

    for (const hotspot of this.hotspots) {
      const probability = hotspot.vulnerabilityProbability ?? 'UNKNOWN';
      counts.set(probability, (counts.get(probability) ?? 0) + 1);
    }

    return probabilityOrder
      .filter((probability) => counts.has(probability))
      .map((probability) => new IssueTreeItem('hotspotProbabilityGroup', probability, vscode.TreeItemCollapsibleState.Collapsed, undefined, [], `${counts.get(probability)} hotspots`));
  }

  private getHotspotItems(probability?: string): IssueTreeItem[] {
    return this.hotspots
      .filter((hotspot) => (hotspot.vulnerabilityProbability ?? 'UNKNOWN') === probability)
      .sort((left, right) => left.message.localeCompare(right.message))
      .map((hotspot) => {
        const location = hotspot.line ? `${hotspot.component}:${hotspot.line}` : hotspot.component;
        return new IssueTreeItem('hotspot', hotspot.message, vscode.TreeItemCollapsibleState.None, undefined, [], location);
      });
  }
}

function unwrapResult<T>(
  result: PromiseSettledResult<T>,
  label: string,
  warnings: string[]
): T extends Array<infer _Item> ? T : T {
  if (result.status === 'fulfilled') {
    return result.value as T extends Array<infer _Item> ? T : T;
  }

  const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
  warnings.push(`${label} could not be loaded: ${message}`);
  return [] as T extends Array<infer _Item> ? T : T;
}

class IssueTreeItem extends vscode.TreeItem {
  public constructor(
    public readonly kind: 'issuesGroup' | 'issueSeverityGroup' | 'coverageGroup' | 'duplicationGroup' | 'hotspotsGroup' | 'hotspotProbabilityGroup' | 'issue' | 'coverage' | 'duplication' | 'hotspot' | 'empty',
    public readonly itemLabel: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly issue?: SonarIssue,
    public readonly issues: SonarIssue[] = [],
    description?: string
  ) {
    super(itemLabel, collapsibleState);
    this.contextValue = getContextValue(kind);
    this.description = description;
    if (
      kind === 'issuesGroup' ||
      kind === 'issueSeverityGroup' ||
      kind === 'coverageGroup' ||
      kind === 'duplicationGroup' ||
      kind === 'hotspotsGroup' ||
      kind === 'hotspotProbabilityGroup'
    ) {
      this.iconPath = new vscode.ThemeIcon('folder-library');
    } else if (kind === 'issue') {
      this.iconPath = new vscode.ThemeIcon('warning');
    } else if (kind === 'coverage') {
      this.iconPath = new vscode.ThemeIcon('beaker');
    } else if (kind === 'duplication') {
      this.iconPath = new vscode.ThemeIcon('files');
    } else if (kind === 'hotspot') {
      this.iconPath = new vscode.ThemeIcon('shield');
    } else if (kind === 'empty') {
      this.iconPath = new vscode.ThemeIcon('info');
    }

    const mode = getWorkspaceMode(kind);
    if (mode) {
      this.command = {
        command: 'sonarPromptFixer.openIssuesWorkspace',
        title: 'Open Sonar Workspace',
        arguments: [mode]
      };
    }
  }
}

function getContextValue(kind: IssueTreeItem['kind']): string {
  if (kind === 'empty') {
    return 'sonarEmpty';
  }

  return 'sonarGroup';
}

function formatPercent(value?: number): string {
  return value === undefined ? 'n/a' : `${value}%`;
}

function getWorkspaceMode(kind: IssueTreeItem['kind']): 'issues' | 'coverage' | 'duplication' | 'hotspots' | undefined {
  if (kind === 'issuesGroup' || kind === 'issueSeverityGroup' || kind === 'issue') {
    return 'issues';
  }

  if (kind === 'coverageGroup' || kind === 'coverage') {
    return 'coverage';
  }

  if (kind === 'duplicationGroup' || kind === 'duplication') {
    return 'duplication';
  }

  if (kind === 'hotspotsGroup' || kind === 'hotspotProbabilityGroup' || kind === 'hotspot') {
    return 'hotspots';
  }

  return undefined;
}
