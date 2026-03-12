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
  IssueFilters,
  SonarConnection,
  SonarCoverageTarget,
  SonarDuplicationTarget,
  SonarIssue,
  SonarKpiSummary,
  SonarRule,
  SonarSecurityHotspot
} from './types';

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

export abstract class SonarBackendBase implements SonarBackend {
  protected readonly httpClient: SonarHttpClient;

  protected constructor(protected readonly connection: SonarConnection, token: string) {
    this.httpClient = new SonarHttpClient(connection, token);
  }

  public async getIssues(_filters?: IssueFilters): Promise<SonarIssue[]> {
    const response = await this.httpClient.getJson<IssuesSearchResponse>('/api/issues/search', {
      componentKeys: this.connection.projectKey,
      ...this.getScopedQuery(),
      statuses: 'OPEN,CONFIRMED,REOPENED',
      ps: 500
    });

    return response.issues.map(mapIssue);
  }

  public async getCoverageTargets(): Promise<SonarCoverageTarget[]> {
    const response = await this.httpClient.getJson<MeasureTreeResponse>('/api/measures/component_tree', {
      component: this.connection.projectKey,
      ...this.getScopedQuery(),
      qualifiers: 'FIL',
      metricKeys: COVERAGE_METRICS.join(','),
      ps: 500
    });

    return response.components.map(mapCoverageTarget).filter(hasCoverageGap);
  }

  public async getDuplicationTargets(): Promise<SonarDuplicationTarget[]> {
    const response = await this.httpClient.getJson<MeasureTreeResponse>('/api/measures/component_tree', {
      component: this.connection.projectKey,
      ...this.getScopedQuery(),
      qualifiers: 'FIL',
      metricKeys: DUPLICATION_METRICS.join(','),
      ps: 500
    });

    return response.components.map(mapDuplicationTarget).filter(hasDuplicationGap);
  }

  public async getSecurityHotspots(): Promise<SonarSecurityHotspot[]> {
    const response = await this.httpClient.getJson<HotspotsSearchResponse>('/api/hotspots/search', {
      projectKey: this.connection.projectKey,
      ...this.getScopedQuery(),
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
      ...this.getScopedQuery(),
      metricKeys: KPI_METRICS.join(',')
    });

    return mapKpiSummary(response.component.measures);
  }

  public async getRules(keys: string[]): Promise<SonarRule[]> {
    if (keys.length === 0) {
      return [];
    }

    const response = await this.httpClient.getJson<RulesSearchResponse>('/api/rules/search', {
      ...this.getRulesQuery(),
      rule_key: keys.join(',')
    });

    return response.rules.map(mapRule);
  }

  public abstract testConnection(): Promise<import('./types').ConnectionTestResult>;
  public abstract getProjectInfo(): Promise<import('./types').SonarProjectInfo>;
  public abstract getCapabilities(): Promise<import('./types').SonarCapabilities>;

  protected getScopedQuery(): Record<string, string | undefined> {
    return {
      organization: this.connection.organization,
      branch: this.connection.branch,
      pullRequest: this.connection.pullRequest
    };
  }

  protected getRulesQuery(): Record<string, string | undefined> {
    return {
      organization: this.connection.organization
    };
  }
}
