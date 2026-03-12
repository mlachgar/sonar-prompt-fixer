import { SonarIssue, SonarIssueType, SonarRule, SonarSeverity } from './types';

type RawIssue = {
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

type RawRule = {
  key: string;
  name: string;
  htmlDesc?: string;
  severity?: SonarSeverity;
  type?: SonarIssueType;
};

export function mapIssue(raw: RawIssue): SonarIssue {
  return {
    key: raw.key,
    rule: raw.rule,
    message: raw.message,
    severity: raw.severity,
    type: raw.type,
    status: raw.status,
    component: raw.component,
    line: raw.line,
    effort: raw.effort,
    tags: raw.tags ?? []
  };
}

export function mapRule(raw: RawRule): SonarRule {
  return {
    key: raw.key,
    name: raw.name,
    htmlDesc: raw.htmlDesc,
    severity: raw.severity,
    type: raw.type
  };
}
