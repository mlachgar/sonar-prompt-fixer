import * as vscode from 'vscode';
import { registerOpenConfigurationEditorCommand } from './commands/openConfigurationEditor';
import { registerOpenIssuesWorkspaceCommand } from './commands/openIssuesWorkspace';
import { SonarIssuesProvider } from './providers/SonarIssuesProvider';
import { ConnectionState } from './state/ConnectionState';
import { FilterState } from './state/FilterState';
import { SelectionState } from './state/SelectionState';
import { ConfigurationEditor } from './webview/configurationEditor';
import { IssuesWorkspaceEditor } from './webview/issuesWorkspaceEditor';

const ONBOARDING_KEY = 'sonarPromptFixer.onboardingShown';

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
  queueOnboarding(context);
}

function queueOnboarding(context: vscode.ExtensionContext): void {
  setTimeout(() => {
    void showOnboardingIfNeeded(context);
  }, 0);
}

async function showOnboardingIfNeeded(context: vscode.ExtensionContext): Promise<void> {
  if (context.globalState.get<boolean>(ONBOARDING_KEY)) {
    return;
  }

  await context.globalState.update(ONBOARDING_KEY, true);

  const action = await vscode.window.showInformationMessage(
    'Sonar Prompt Fixer is available in the Activity Bar. Open the Issues view to configure the connection or review issues.',
    'Open Configuration',
    'Open Issues Workspace'
  );

  if (action === 'Open Configuration') {
    await vscode.commands.executeCommand('sonarPromptFixer.openConfigurationEditor');
    return;
  }

  if (action === 'Open Issues Workspace') {
    await vscode.commands.executeCommand('sonarPromptFixer.openIssuesWorkspace');
  }
}
