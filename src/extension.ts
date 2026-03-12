import * as vscode from 'vscode';
import { registerOpenConfigurationEditorCommand } from './commands/openConfigurationEditor';
import { registerOpenIssuesWorkspaceCommand } from './commands/openIssuesWorkspace';
import { createSonarBackend } from './sonar/SonarBackendFactory';
import { SonarIssuesProvider } from './providers/SonarIssuesProvider';
import { ConnectionState } from './state/ConnectionState';
import { FilterState } from './state/FilterState';
import { SelectionState } from './state/SelectionState';
import { ConfigurationError } from './util/errors';
import { ConfigurationEditor } from './webview/configurationEditor';
import { FindingsSummaryView } from './webview/findingsSummaryView';
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
    connectionState
  );
  const findingsSummaryView = new FindingsSummaryView(issuesProvider, connectionState, issuesWorkspaceEditor);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(FindingsSummaryView.viewType, findingsSummaryView)
  );

  registerOpenConfigurationEditorCommand(context, configurationEditor);
  registerOpenIssuesWorkspaceCommand(context, issuesWorkspaceEditor);

  context.subscriptions.push(
    filterState.onDidChange(() => {
      issuesProvider.refresh();
      issuesWorkspaceEditor.update();
    }),
    selectionState.onDidChange(() => {
      issuesWorkspaceEditor.update();
    }),
    connectionState.onDidChange(() => {
      void (async () => {
        await issuesProvider.reloadFindings();
        await issuesWorkspaceEditor.reloadData();
        findingsSummaryView.update();
      })();
      configurationEditor.update();
      findingsSummaryView.update();
    }),
    issuesProvider.onDidChangeIssues(() => {
      issuesWorkspaceEditor.update();
      findingsSummaryView.update();
    })
  );

  void configurationEditor.initialize();
  void preloadActiveProfileFindings(connectionState, issuesProvider, findingsSummaryView);
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
    'Sonar Prompt Fixer is available in the Activity Bar. Open the Findings view to configure the connection or review project findings.',
    'Open Configuration',
    'Open Sonar Workspace'
  );

  if (action === 'Open Configuration') {
    await vscode.commands.executeCommand('sonarPromptFixer.openConfigurationEditor');
    return;
  }

  if (action === 'Open Sonar Workspace') {
    await vscode.commands.executeCommand('sonarPromptFixer.openIssuesWorkspace');
  }
}

async function preloadActiveProfileFindings(
  connectionState: ConnectionState,
  issuesProvider: SonarIssuesProvider,
  findingsSummaryView: FindingsSummaryView
): Promise<void> {
  const activeProfile = connectionState.getActiveProfile();
  if (activeProfile.id === '__default__') {
    return;
  }

  try {
    createSonarBackend(connectionState.getConnection(), await connectionState.getToken());
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      console.warn('Sonar Prompt Fixer startup preload skipped:', error);
    }
    return;
  }

  findingsSummaryView.update();
  void issuesProvider.loadFindings();
}
