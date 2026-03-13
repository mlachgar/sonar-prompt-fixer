import * as vscode from 'vscode';
import { SonarIssue } from '../sonar/types';

export class SelectionState {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;
  private readonly selectedKeys = new Set<string>();
  private issueByKey = new Map<string, SonarIssue>();

  public setKnownIssues(issues: SonarIssue[]): void {
    this.issueByKey = new Map(issues.map((issue) => [issue.key, issue]));
    for (const key of this.selectedKeys) {
      if (!this.issueByKey.has(key)) {
        this.selectedKeys.delete(key);
      }
    }
  }

  public isSelected(issueKey: string): boolean {
    return this.selectedKeys.has(issueKey);
  }

  public toggle(issue: SonarIssue): void {
    if (this.selectedKeys.has(issue.key)) {
      this.selectedKeys.delete(issue.key);
    } else {
      this.selectedKeys.add(issue.key);
      this.issueByKey.set(issue.key, issue);
    }
    this.onDidChangeEmitter.fire();
  }

  public selectMany(issues: SonarIssue[]): void {
    for (const issue of issues) {
      this.selectedKeys.add(issue.key);
      this.issueByKey.set(issue.key, issue);
    }
    this.onDidChangeEmitter.fire();
  }

  public clear(): void {
    this.selectedKeys.clear();
    this.onDidChangeEmitter.fire();
  }

  public getSelectedIssues(): SonarIssue[] {
    const selectedIssues: SonarIssue[] = [];

    for (const key of this.selectedKeys) {
      const issue = this.issueByKey.get(key);
      if (issue) {
        selectedIssues.push(issue);
      }
    }

    return selectedIssues;
  }

  public getSelectedCount(): number {
    return this.selectedKeys.size;
  }
}
