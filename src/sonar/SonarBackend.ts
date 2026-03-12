import { ConnectionTestResult, IssueFilters, SonarCapabilities, SonarIssue, SonarProjectInfo, SonarRule } from './types';

export interface SonarBackend {
  testConnection(): Promise<ConnectionTestResult>;
  getIssues(filters?: IssueFilters): Promise<SonarIssue[]>;
  getRules(keys: string[]): Promise<SonarRule[]>;
  getProjectInfo(): Promise<SonarProjectInfo>;
  getCapabilities(): Promise<SonarCapabilities>;
}
