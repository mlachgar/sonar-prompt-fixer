import {
  ConnectionTestResult,
  IssueFilters,
  SonarCapabilities,
  SonarCoverageTarget,
  SonarDuplicationTarget,
  SonarIssue,
  SonarKpiSummary,
  SonarProjectInfo,
  SonarRule,
  SonarSecurityHotspot
} from './types';

export interface SonarBackend {
  testConnection(): Promise<ConnectionTestResult>;
  getIssues(filters?: IssueFilters): Promise<SonarIssue[]>;
  getCoverageTargets(): Promise<SonarCoverageTarget[]>;
  getDuplicationTargets(): Promise<SonarDuplicationTarget[]>;
  getSecurityHotspots(): Promise<SonarSecurityHotspot[]>;
  getKpiSummary(): Promise<SonarKpiSummary>;
  getRules(keys: string[]): Promise<SonarRule[]>;
  getProjectInfo(): Promise<SonarProjectInfo>;
  getCapabilities(): Promise<SonarCapabilities>;
}
