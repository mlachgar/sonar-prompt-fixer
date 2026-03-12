import { SonarBackendBase } from './SonarBackendBase';
import {
  ConnectionTestResult,
  SonarCapabilities,
  SonarConnection,
  SonarProjectInfo,
} from './types';
import { HttpError } from '../util/errors';
import { mapConnectionError } from '../util/diagnostics';

type ProjectSearchResponse = {
  components: Array<{
    key: string;
    name: string;
    qualifier?: string;
  }>;
};

export class SonarQubeServerBackend extends SonarBackendBase {
  public constructor(connection: SonarConnection, token: string) {
    super(connection, token);
  }

  public async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.httpClient.getJson('/api/authentication/validate');
      await this.getProjectInfo();
      return {
        ok: true,
        kind: 'success',
        message: 'Connection succeeded and the configured project is accessible.'
      };
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 404) {
        return {
          ok: false,
          kind: 'projectNotFound',
          message: 'The Sonar server is reachable, but the configured project key was not found.',
          details: error.responseBody
        };
      }

      return mapConnectionError(error);
    }
  }

  public async getProjectInfo(): Promise<SonarProjectInfo> {
    const response = await this.httpClient.getJson<ProjectSearchResponse>('/api/components/search', {
      qualifiers: 'TRK',
      q: this.connection.projectKey,
      ps: 100
    });

    const project = response.components.find((component) => component.key === this.connection.projectKey);
    if (!project) {
      throw new HttpError('Project not found', 404);
    }

    return project;
  }

  protected override getScopedQuery(): Record<string, string | undefined> {
    return {
      branch: this.connection.branch,
      pullRequest: this.connection.pullRequest
    };
  }

  protected override getRulesQuery(): Record<string, string | undefined> {
    return {};
  }

  public async getCapabilities(): Promise<SonarCapabilities> {
    let version: string | undefined;
    try {
      version = await this.httpClient.getText('/api/server/version');
    } catch {
      version = undefined;
    }

    return {
      supportsBearerAuth: true,
      supportsBasicTokenAuth: true,
      isCloud: false,
      serverVersion: version?.trim()
    };
  }
}
