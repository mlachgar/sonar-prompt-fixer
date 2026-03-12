import * as vscode from 'vscode';
import { ConfigurationEditor } from '../webview/configurationEditor';

export function registerOpenConfigurationEditorCommand(
  context: vscode.ExtensionContext,
  configurationEditor: ConfigurationEditor
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('sonarPromptFixer.openConfigurationEditor', async () => {
      await configurationEditor.open();
    })
  );
}
