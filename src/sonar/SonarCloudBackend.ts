import { SonarBackend } from './SonarBackend';
import { SonarHttpClient } from './SonarHttpClient';
import { mapIssue, mapRule } from './mappers';
import { ConnectionTestResult, IssueFilters, SonarCapabilities, SonarConnection, SonarIssue, SonarProjectInfo, SonarRule } from './types';
import { mapConnectionError } from '../util/diagnostics';

type IssuesSearchResponse = {
  issues: Array<{
    key: string;
    rule: string;
    message: string;
    severity: SonarIssue['severity'];
    type: SonarIssue['type'];
    status?: string;
    component: string;
    line?: number;
    effort?: string;
    tags?: string[];
  }>;
};

type RulesSearchResponse = {
  rules: Array<{
    key: string;
    name: string;
    htmlDesc?: string;
    severity?: SonarIssue['severity'];
    type?: SonarIssue['type'];
  }>;
};

type ProjectShowResponse = {
  component: {
    key: string;
    name: string;
    qualifier?: string;
  };
};

export class SonarCloudBackend implements SonarBackend {
  private readonly httpClient: SonarHttpClient;

  public constructor(private readonly connection: SonarConnection, token: string) {
    this.httpClient = new SonarHttpClient(connection, token);
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

  public async getIssues(_filters?: IssueFilters): Promise<SonarIssue[]> {
    const response = await this.httpClient.getJson<IssuesSearchResponse>('/api/issues/search', {
      componentKeys: this.connection.projectKey,
      organization: this.connection.organization,
      branch: this.connection.branch,
      pullRequest: this.connection.pullRequest,
      statuses: 'OPEN,CONFIRMED,REOPENED',
      ps: 500
    });

    return response.issues.map(mapIssue);
  }

  public async getRules(keys: string[]): Promise<SonarRule[]> {
    if (keys.length === 0) {
      return [];
    }

    const response = await this.httpClient.getJson<RulesSearchResponse>('/api/rules/search', {
      organization: this.connection.organization,
      rule_key: keys.join(',')
    });

    return response.rules.map(mapRule);
  }

  public async getProjectInfo(): Promise<SonarProjectInfo> {
    const response = await this.httpClient.getJson<ProjectShowResponse>('/api/components/show', {
      component: this.connection.projectKey,
      organization: this.connection.organization,
      branch: this.connection.branch,
      pullRequest: this.connection.pullRequest
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
