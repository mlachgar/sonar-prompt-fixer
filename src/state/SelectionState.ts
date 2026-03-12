import * as vscode from 'vscode';
import { SonarIssue } from '../sonar/types';

export class SelectionState {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;
  private readonly selectedKeys = new Set<string>();
  private issueByKey = new Map<string, SonarIssue>();

  public setKnownIssues(issues: SonarIssue[]): void {
    this.issueByKey = new Map(issues.map((issue) => [issue.key, issue]));
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
    return [...this.selectedKeys]
      .map((key) => this.issueByKey.get(key))
      .filter((issue): issue is SonarIssue => Boolean(issue));
  }

  public getSelectedCount(): number {
    return this.selectedKeys.size;
  }
}
