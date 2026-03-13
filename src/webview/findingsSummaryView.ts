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
  type: 'selectProject';
  projectPath: string;
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

      if (message.type === 'selectProject') {
        await this.connectionState.selectProject(message.projectPath);
        await this.issuesProvider.reloadFindings();
        await this.issuesWorkspaceEditor.reloadData();
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
    const activeConnection = activeProfile ? this.connectionState.getConnection() : undefined;
    const activeProject = this.connectionState.getActiveProject();
    const hasSummary = this.issuesProvider.hasLoadedData() && !this.issuesProvider.isLoading() && Boolean(activeProfile);
    const payload = {
      loading: this.issuesProvider.isLoading(),
      hasSummary,
      activeProfileName: activeProfile?.name ?? '',
      activeProfileTarget: activeConnection?.projectKey || activeProfile?.connection.baseUrl || '',
      activeProfileId: activeProfile?.id ?? '',
      activeProjectPath: activeProject?.directory ?? '',
      activeProjectLabel: activeProject?.label ?? '',
      profiles: this.connectionState.getProfiles().map((profile) => ({
        id: profile.id,
        name: profile.name,
        target: profile.connection.baseUrl
      })),
      projects: this.connectionState.getProjects().map((project) => ({
        path: project.directory,
        label: project.label,
        projectKey: project.projectKey
      })),
      counts: hasSummary ? [
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
      ] : []
    };

    this.view.webview.html = renderFindingsSummaryHtml(this.view.webview, payload);
    this.view.webview.postMessage(payload).then(undefined, () => undefined);
  }
}
