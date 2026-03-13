import * as vscode from 'vscode';
import { ConnectionState } from '../state/ConnectionState';

export function registerResetStateCommand(
  context: vscode.ExtensionContext,
  connectionState: ConnectionState
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('sonarPromptFixer.resetState', async () => {
      await connectionState.resetConnectionsAndProjects();
      void vscode.window.showInformationMessage('Sonar Prompt Fixer connections and project selection have been reset.');
    })
  );
}
