import * as vscode from 'vscode';
import { IssueFilters, SonarIssue } from '../sonar/types';

const EMPTY_FILTERS: IssueFilters = {
  types: [],
  severities: [],
  statuses: [],
  ruleQuery: undefined,
  componentQuery: undefined
};

export class FilterState {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;
  private filters: IssueFilters = { ...EMPTY_FILTERS };

  public getFilters(): IssueFilters {
    return {
      ...this.filters,
      types: [...this.filters.types],
      severities: [...this.filters.severities],
      statuses: [...this.filters.statuses]
    };
  }

  public setFilters(filters: IssueFilters): void {
    this.filters = {
      ...filters,
      types: [...filters.types],
      severities: [...filters.severities],
      statuses: [...filters.statuses]
    };
    this.onDidChangeEmitter.fire();
  }

  public clear(): void {
    this.filters = { ...EMPTY_FILTERS };
    this.onDidChangeEmitter.fire();
  }

  public apply(issues: SonarIssue[]): SonarIssue[] {
    const filters = this.filters;
    return issues.filter((issue) => {
      if (filters.types.length > 0 && !filters.types.includes(issue.type)) {
        return false;
      }
      if (filters.severities.length > 0 && !filters.severities.includes(issue.severity)) {
        return false;
      }
      if (filters.statuses.length > 0 && !filters.statuses.includes(issue.status ?? 'OPEN')) {
        return false;
      }
      if (filters.ruleQuery && !issue.rule.toLowerCase().includes(filters.ruleQuery.toLowerCase())) {
        return false;
      }
      if (filters.componentQuery && !issue.component.toLowerCase().includes(filters.componentQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }
}
