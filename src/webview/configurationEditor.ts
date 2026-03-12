import * as vscode from 'vscode';
import { createSonarBackend } from '../sonar/SonarBackendFactory';
import { SonarConnection, SonarConnectionProfile } from '../sonar/types';
import { ConnectionState } from '../state/ConnectionState';
import { ConfigurationError } from '../util/errors';
import { renderConfigurationEditorHtml } from './configurationEditor.html';

type EditableProfile = Partial<SonarConnectionProfile> & { connection: SonarConnection };

type ConfigurationMessage =
  | { type: 'saveProfile'; profile: EditableProfile; token: string }
  | { type: 'selectProfile'; profileId: string }
  | { type: 'deleteProfile'; profileId: string }
  | { type: 'testConnection'; connection: SonarConnection; token: string };

export class ConfigurationEditor {
  private panel?: vscode.WebviewPanel;
  private token = '';
  private statusMessage = 'Save a Sonar profile and token, then test the connection.';
  private statusKind: 'info' | 'success' | 'error' = 'info';

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly connectionState: ConnectionState
  ) {}

  public async initialize(): Promise<void> {
    this.token = (await this.connectionState.getToken()) ?? '';
  }

  public async open(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      await this.refreshToken();
      this.update();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'sonarPromptFixer.configurationEditor',
      'Sonar Prompt Fixer Configuration',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (message: ConfigurationMessage) => {
      if (message.type === 'saveProfile') {
        await this.saveProfile(message.profile, message.token);
        return;
      }

      if (message.type === 'selectProfile') {
        await this.selectProfile(message.profileId);
        return;
      }

      if (message.type === 'deleteProfile') {
        await this.deleteProfile(message.profileId);
        return;
      }

      if (message.type === 'testConnection') {
        await this.testConnection(message.connection, message.token);
      }
    });

    await this.refreshToken();
    this.update();
  }

  public update(): void {
    void this.refreshAndUpdate();
  }

  private async refreshAndUpdate(): Promise<void> {
    if (!this.panel) {
      return;
    }

    await this.refreshToken();

    const activeProfile = this.connectionState.getActiveProfile();
    const payload = {
      profiles: this.connectionState.getProfiles().map((profile) => ({
        id: profile.id,
        name: profile.name,
        type: profile.connection.type,
        baseUrl: profile.connection.baseUrl,
        projectKey: profile.connection.projectKey
      })),
      activeProfile,
      hasToken: this.token.length > 0,
      token: this.token,
      statusMessage: this.statusMessage,
      statusKind: this.statusKind
    };

    this.panel.webview.html = renderConfigurationEditorHtml(this.panel.webview, payload);
    this.panel.webview.postMessage(payload).then(undefined, () => undefined);
  }

  private async saveProfile(profile: EditableProfile, token: string): Promise<void> {
    try {
      const savedProfile = await this.connectionState.saveProfile(profile, token);
      this.token = token.trim();
      this.statusMessage = `Saved profile "${savedProfile.name}".`;
      this.statusKind = 'success';
      this.update();
    } catch (error) {
      this.statusMessage = error instanceof Error ? error.message : 'Failed to save Sonar profile.';
      this.statusKind = 'error';
      this.update();
    }
  }

  private async selectProfile(profileId: string): Promise<void> {
    await this.connectionState.selectProfile(profileId);
    await this.refreshToken();
    this.statusMessage = `Active profile switched to "${this.connectionState.getActiveProfile().name}".`;
    this.statusKind = 'info';
    this.update();
  }

  private async deleteProfile(profileId: string): Promise<void> {
    const profile = this.connectionState.getProfiles().find((item) => item.id === profileId);
    if (!profile || profile.id === '__default__') {
      return;
    }

    await this.connectionState.deleteProfile(profileId);
    await this.refreshToken();
    this.statusMessage = `Deleted profile "${profile.name}".`;
    this.statusKind = 'success';
    this.update();
  }

  private async testConnection(connection: SonarConnection, token: string): Promise<void> {
    try {
      const trimmedToken = token.trim();
      const backend = createSonarBackend({
        ...connection,
        baseUrl: connection.baseUrl.trim(),
        projectKey: connection.projectKey.trim(),
        organization: connection.organization?.trim() || undefined,
        branch: connection.branch?.trim() || undefined,
        pullRequest: connection.pullRequest?.trim() || undefined
      }, trimmedToken || undefined);
      const result = await backend.testConnection();
      this.statusMessage = result.details ? `${result.message} ${result.details}` : result.message;
      this.statusKind = result.ok ? 'success' : 'error';
      this.update();
    } catch (error) {
      if (error instanceof ConfigurationError) {
        this.statusMessage = error.message;
        this.statusKind = 'error';
        this.update();
        return;
      }

      this.statusMessage = error instanceof Error ? error.message : 'Connection test failed.';
      this.statusKind = 'error';
      this.update();
    }
  }

  private async refreshToken(): Promise<void> {
    this.token = (await this.connectionState.getToken()) ?? '';
  }
}
