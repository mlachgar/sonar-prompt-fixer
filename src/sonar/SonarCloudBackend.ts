import { SonarBackendBase } from './SonarBackendBase';
import {
  ConnectionTestResult,
  SonarCapabilities,
  SonarProjectInfo,
  SonarConnection
} from './types';
import { mapConnectionError } from '../util/diagnostics';

type ProjectShowResponse = {
  component: {
    key: string;
    name: string;
    qualifier?: string;
  };
};

export class SonarCloudBackend extends SonarBackendBase {
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
      return mapConnectionError(error);
    }
  }

  public async getProjectInfo(): Promise<SonarProjectInfo> {
    const response = await this.httpClient.getJson<ProjectShowResponse>('/api/components/show', {
      component: this.connection.projectKey,
      ...this.getScopedQuery()
    });

    return response.component;
  }

  public async getCapabilities(): Promise<SonarCapabilities> {
    return {
      supportsBearerAuth: true,
      supportsBasicTokenAuth: false,
      isCloud: true,
      serverVersion: 'cloud'
    };
  }
}
