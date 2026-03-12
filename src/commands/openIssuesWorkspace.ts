import * as vscode from 'vscode';
import { IssuesWorkspaceEditor } from '../webview/issuesWorkspaceEditor';

export function registerOpenIssuesWorkspaceCommand(
  context: vscode.ExtensionContext,
  issuesWorkspaceEditor: IssuesWorkspaceEditor
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('sonarPromptFixer.openIssuesWorkspace', async (mode?: 'issues' | 'coverage' | 'duplication' | 'hotspots') => {
      await issuesWorkspaceEditor.open(mode);
    })
  );
}
