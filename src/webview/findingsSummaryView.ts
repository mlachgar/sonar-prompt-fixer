import * as vscode from 'vscode';
import { SonarIssuesProvider } from '../providers/SonarIssuesProvider';
import { ConnectionState } from '../state/ConnectionState';
import { IssuesWorkspaceEditor } from './issuesWorkspaceEditor';
import { renderFindingsSummaryHtml } from './findingsSummaryView.html';

type FindingsSummaryMessage = {
  type: 'openMode';
  mode: 'issues' | 'coverage' | 'duplication' | 'hotspots';
} | {
  type: 'selectProfile';
  profileId: string;
} | {
  type: 'refresh';
};

export class FindingsSummaryView implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sonarPromptFixer.issues';

  private view?: vscode.WebviewView;

  public constructor(
    private readonly issuesProvider: SonarIssuesProvider,
    private readonly connectionState: ConnectionState,
    private readonly issuesWorkspaceEditor: IssuesWorkspaceEditor
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };
    webviewView.webview.onDidReceiveMessage(async (message: FindingsSummaryMessage) => {
      if (message.type === 'openMode') {
        await this.issuesWorkspaceEditor.open(message.mode);
        return;
      }

      if (message.type === 'selectProfile') {
        await this.connectionState.selectProfile(message.profileId);
        this.update();
        return;
      }

      if (message.type === 'refresh') {
        await this.issuesProvider.reloadFindings();
        await this.issuesWorkspaceEditor.reloadData();
        this.update();
      }
    });
    this.update();
  }

  public update(): void {
    if (!this.view) {
      return;
    }

    const activeProfile = this.connectionState.getActiveProfile();
    const payload = {
      loading: this.issuesProvider.isLoading(),
      activeProfileName: activeProfile.name,
      activeProfileTarget: activeProfile.connection.projectKey || activeProfile.connection.baseUrl,
      activeProfileId: activeProfile.id,
      profiles: this.connectionState.getProfiles().map((profile) => ({
        id: profile.id,
        name: profile.name,
        target: profile.connection.projectKey || profile.connection.baseUrl
      })),
      counts: [
        {
          mode: 'issues' as const,
          label: 'Issues',
          count: this.issuesProvider.getAllIssues().length,
          accent: 'var(--vscode-testing-iconFailed)'
        },
        {
          mode: 'coverage' as const,
          label: 'Coverage',
          count: this.issuesProvider.getCoverageTargets().length,
          accent: '#0f9d58'
        },
        {
          mode: 'duplication' as const,
          label: 'Duplications',
          count: this.issuesProvider.getDuplicationTargets().length,
          accent: '#d97706'
        },
        {
          mode: 'hotspots' as const,
          label: 'Security Hotspots',
          count: this.issuesProvider.getHotspots().length,
          accent: '#dc2626'
        }
      ]
    };

    this.view.webview.html = renderFindingsSummaryHtml(this.view.webview, payload);
    this.view.webview.postMessage(payload).then(undefined, () => undefined);
  }
}
