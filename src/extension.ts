import * as vscode from 'vscode';
import { registerOpenConfigurationEditorCommand } from './commands/openConfigurationEditor';
import { registerOpenIssuesWorkspaceCommand } from './commands/openIssuesWorkspace';
import { SonarIssuesProvider } from './providers/SonarIssuesProvider';
import { ConnectionState } from './state/ConnectionState';
import { FilterState } from './state/FilterState';
import { SelectionState } from './state/SelectionState';
import { ConfigurationEditor } from './webview/configurationEditor';
import { IssuesWorkspaceEditor } from './webview/issuesWorkspaceEditor';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const connectionState = new ConnectionState(context);
  const filterState = new FilterState();
  const selectionState = new SelectionState();
  const issuesProvider = new SonarIssuesProvider(context, connectionState, filterState, selectionState);
  const configurationEditor = new ConfigurationEditor(context, connectionState);
  const issuesWorkspaceEditor = new IssuesWorkspaceEditor(
    issuesProvider,
    filterState,
    selectionState,
    configurationEditor
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('sonarPromptFixer.issues', issuesProvider)
  );

  registerOpenConfigurationEditorCommand(context, configurationEditor);
  registerOpenIssuesWorkspaceCommand(context, issuesWorkspaceEditor);

  context.subscriptions.push(
    filterState.onDidChange(() => {
      issuesProvider.refresh();
      issuesWorkspaceEditor.update();
    }),
    selectionState.onDidChange(() => {
      issuesProvider.notifyViewChanged();
    }),
    connectionState.onDidChange(() => {
      void issuesProvider.loadIssues();
      configurationEditor.update();
      issuesWorkspaceEditor.update();
    }),
    issuesProvider.onDidChangeIssues(() => {
      issuesWorkspaceEditor.update();
    })
  );

  await configurationEditor.initialize();
}
