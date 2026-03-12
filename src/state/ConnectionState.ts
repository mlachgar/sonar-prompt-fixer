import * as vscode from 'vscode';
import { SonarConnection } from '../sonar/types';
import { loadToken } from '../util/secrets';
import { loadSonarProjectProperties } from '../util/sonarProjectProperties';

export class ConnectionState {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;

  public constructor(private readonly context: vscode.ExtensionContext) {}

  public getConnection(): SonarConnection {
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    const fallbackProperties = loadSonarProjectProperties();
    const baseUrl = config.get<string>('connection.baseUrl', 'https://sonarcloud.io').trim();
    const configuredProjectKey = config.get<string>('connection.projectKey', '').trim();
    const configuredOrganization = config.get<string>('connection.organization', '').trim();
    const branch = config.get<string>('connection.branch', '').trim();
    const pullRequest = config.get<string>('connection.pullRequest', '').trim();
    const projectKey = configuredProjectKey || fallbackProperties.projectKey || '';
    const organization = configuredOrganization || fallbackProperties.organization || '';

    return {
      type: config.get<'cloud' | 'server'>('connection.type', 'cloud'),
      baseUrl,
      projectKey,
      organization: organization || undefined,
      branch: branch || undefined,
      pullRequest: pullRequest || undefined,
      verifyTls: config.get<boolean>('connection.verifyTls', true),
      authMode: config.get<'bearer' | 'basicToken'>('connection.authMode', 'bearer')
    };
  }

  public async getToken(): Promise<string | undefined> {
    return loadToken(this.context.secrets);
  }

  public async updateSetting<T>(section: string, value: T): Promise<void> {
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    await config.update(section, value, vscode.ConfigurationTarget.Global);
    this.onDidChangeEmitter.fire();
  }

  public async updateConnection(connection: SonarConnection): Promise<void> {
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    await config.update('connection.type', connection.type, vscode.ConfigurationTarget.Global);
    await config.update('connection.baseUrl', connection.baseUrl, vscode.ConfigurationTarget.Global);
    await config.update('connection.projectKey', connection.projectKey, vscode.ConfigurationTarget.Global);
    await config.update('connection.organization', connection.organization ?? '', vscode.ConfigurationTarget.Global);
    await config.update('connection.branch', connection.branch ?? '', vscode.ConfigurationTarget.Global);
    await config.update('connection.pullRequest', connection.pullRequest ?? '', vscode.ConfigurationTarget.Global);
    await config.update('connection.verifyTls', connection.verifyTls ?? true, vscode.ConfigurationTarget.Global);
    await config.update('connection.authMode', connection.authMode ?? 'bearer', vscode.ConfigurationTarget.Global);
    this.onDidChangeEmitter.fire();
  }

  public notifyChanged(): void {
    this.onDidChangeEmitter.fire();
  }
}
