import * as vscode from 'vscode';
import { createSonarBackend } from '../sonar/SonarBackendFactory';
import { SonarConnection } from '../sonar/types';
import { ConnectionState } from '../state/ConnectionState';
import { ConfigurationError } from '../util/errors';
import { deleteToken, storeToken } from '../util/secrets';
import { renderConfigurationEditorHtml } from './configurationEditor.html';

type ConfigurationMessage =
  | { type: 'saveConfiguration'; connection: SonarConnection; token: string }
  | { type: 'testConnection' };

export class ConfigurationEditor {
  private panel?: vscode.WebviewPanel;
  private token = '';
  private statusMessage = 'Save your Sonar settings and token, then test the connection.';
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
      if (message.type === 'saveConfiguration') {
        await this.saveConfiguration(message.connection, message.token);
        return;
      }

      if (message.type === 'testConnection') {
        await this.testConnection();
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

    const payload = {
      connection: this.connectionState.getConnection(),
      hasToken: this.token.length > 0,
      token: this.token,
      statusMessage: this.statusMessage,
      statusKind: this.statusKind
    };

    this.panel.webview.html = renderConfigurationEditorHtml(this.panel.webview, payload);
    this.panel.webview.postMessage(payload).then(undefined, () => undefined);
  }

  private async saveConfiguration(connection: SonarConnection, token: string): Promise<void> {
    try {
      await this.connectionState.updateConnection({
        ...connection,
        baseUrl: connection.baseUrl.trim(),
        projectKey: connection.projectKey.trim(),
        organization: connection.organization?.trim() || undefined,
        branch: connection.branch?.trim() || undefined,
        pullRequest: connection.pullRequest?.trim() || undefined
      });

      const trimmedToken = token.trim();
      if (trimmedToken === '') {
        await deleteToken(this.context.secrets);
        this.token = '';
        this.statusMessage = 'Connection settings saved and stored token cleared.';
      } else {
        await storeToken(this.context.secrets, trimmedToken);
        this.token = trimmedToken;
        this.statusMessage = 'Connection settings and token saved.';
      }

      this.statusKind = 'success';
      this.update();
    } catch (error) {
      this.statusMessage = error instanceof Error ? error.message : 'Failed to save connection settings.';
      this.statusKind = 'error';
      this.update();
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const backend = createSonarBackend(this.connectionState.getConnection(), await this.connectionState.getToken());
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
