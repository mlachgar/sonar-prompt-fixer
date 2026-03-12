import { SonarBackend } from './SonarBackend';
import { SonarHttpClient } from './SonarHttpClient';
import {
  COVERAGE_METRICS,
  DUPLICATION_METRICS,
  hasCoverageGap,
  hasDuplicationGap,
  KPI_METRICS,
  mapCoverageTarget,
  mapDuplicationTarget,
  mapKpiSummary,
  SonarMeasure,
  SonarMeasureComponent
} from './measureHelpers';
import { mapIssue, mapRule } from './mappers';
import {
  ConnectionTestResult,
  IssueFilters,
  SonarCapabilities,
  SonarConnection,
  SonarCoverageTarget,
  SonarDuplicationTarget,
  SonarIssue,
  SonarKpiSummary,
  SonarProjectInfo,
  SonarRule,
  SonarSecurityHotspot
} from './types';
import { HttpError } from '../util/errors';
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

type ProjectSearchResponse = {
  components: Array<{
    key: string;
    name: string;
    qualifier?: string;
  }>;
};

type MeasuresResponse = {
  component: {
    measures: SonarMeasure[];
  };
};

type MeasureTreeResponse = {
  components: SonarMeasureComponent[];
};

type HotspotsSearchResponse = {
  hotspots: Array<{
    key: string;
    component: string;
    line?: number;
    message: string;
    status?: string;
    vulnerabilityProbability?: string;
  }>;
};

export class SonarQubeServerBackend implements SonarBackend {
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

  public async getIssues(_filters?: IssueFilters): Promise<SonarIssue[]> {
    const response = await this.httpClient.getJson<IssuesSearchResponse>('/api/issues/search', {
      componentKeys: this.connection.projectKey,
      branch: this.connection.branch,
      pullRequest: this.connection.pullRequest,
      statuses: 'OPEN,CONFIRMED,REOPENED',
      ps: 500
    });

    return response.issues.map(mapIssue);
  }

  public async getCoverageTargets(): Promise<SonarCoverageTarget[]> {
    const response = await this.httpClient.getJson<MeasureTreeResponse>('/api/measures/component_tree', {
      component: this.connection.projectKey,
      branch: this.connection.branch,
      pullRequest: this.connection.pullRequest,
      qualifiers: 'FIL',
      metricKeys: COVERAGE_METRICS.join(','),
      ps: 500
    });

    return response.components
      .map(mapCoverageTarget)
      .filter(hasCoverageGap);
  }

  public async getDuplicationTargets(): Promise<SonarDuplicationTarget[]> {
    const response = await this.httpClient.getJson<MeasureTreeResponse>('/api/measures/component_tree', {
      component: this.connection.projectKey,
      branch: this.connection.branch,
      pullRequest: this.connection.pullRequest,
      qualifiers: 'FIL',
      metricKeys: DUPLICATION_METRICS.join(','),
      ps: 500
    });

    return response.components
      .map(mapDuplicationTarget)
      .filter(hasDuplicationGap);
  }

  public async getSecurityHotspots(): Promise<SonarSecurityHotspot[]> {
    const response = await this.httpClient.getJson<HotspotsSearchResponse>('/api/hotspots/search', {
      projectKey: this.connection.projectKey,
      branch: this.connection.branch,
      pullRequest: this.connection.pullRequest,
      status: 'TO_REVIEW',
      ps: 500
    });

    return response.hotspots.map((hotspot) => ({
      key: hotspot.key,
      component: hotspot.component,
      line: hotspot.line,
      message: hotspot.message,
      status: hotspot.status,
      vulnerabilityProbability: hotspot.vulnerabilityProbability
    }));
  }

  public async getKpiSummary(): Promise<SonarKpiSummary> {
    const response = await this.httpClient.getJson<MeasuresResponse>('/api/measures/component', {
      component: this.connection.projectKey,
      branch: this.connection.branch,
      pullRequest: this.connection.pullRequest,
      metricKeys: KPI_METRICS.join(',')
    });

    return mapKpiSummary(response.component.measures);
  }

  public async getRules(keys: string[]): Promise<SonarRule[]> {
    if (keys.length === 0) {
      return [];
    }

    const response = await this.httpClient.getJson<RulesSearchResponse>('/api/rules/search', {
      rule_key: keys.join(',')
    });

    return response.rules.map(mapRule);
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
