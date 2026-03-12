export type SonarTargetType = 'cloud' | 'server';
export type SonarSeverity = 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';
export type SonarIssueType = 'BUG' | 'VULNERABILITY' | 'CODE_SMELL';

export type SonarIssue = {
  key: string;
  rule: string;
  message: string;
  severity: SonarSeverity;
  type: SonarIssueType;
  status?: string;
  component: string;
  line?: number;
  effort?: string;
  tags?: string[];
};

export type SonarConnection = {
  type: SonarTargetType;
  baseUrl: string;
  projectKey: string;
  organization?: string;
  branch?: string;
  pullRequest?: string;
  verifyTls?: boolean;
  authMode?: 'bearer' | 'basicToken';
};

export type IssueFilters = {
  types: SonarIssueType[];
  severities: SonarSeverity[];
  statuses: string[];
  ruleQuery?: string;
  componentQuery?: string;
};

export type SonarCapabilities = {
  supportsBearerAuth: boolean;
  supportsBasicTokenAuth: boolean;
  serverVersion?: string;
  isCloud: boolean;
};

export type SonarRule = {
  key: string;
  name: string;
  htmlDesc?: string;
  severity?: SonarSeverity;
  type?: SonarIssueType;
};

export type SonarProjectInfo = {
  key: string;
  name: string;
  qualifier?: string;
};

export type ConnectionTestResult = {
  ok: boolean;
  message: string;
  kind:
    | 'success'
    | 'network'
    | 'tls'
    | 'auth'
    | 'notFound'
    | 'projectNotFound'
    | 'configuration'
    | 'unknown';
  details?: string;
};
