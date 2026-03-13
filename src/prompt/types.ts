import { SonarConnection, SonarCoverageTarget, SonarDuplicationTarget, SonarIssue, SonarSecurityHotspot } from '../sonar/types';

export type PromptTarget = 'codex' | 'claude' | 'qwen';
export type PromptStyle = 'minimal' | 'balanced' | 'guided';
export type PromptSource = 'issues' | 'coverage' | 'duplication' | 'hotspots';

export type PromptSelection = {
  source: PromptSource;
  issues?: SonarIssue[];
  coverageTargets?: SonarCoverageTarget[];
  duplicationTargets?: SonarDuplicationTarget[];
  hotspots?: SonarSecurityHotspot[];
};

export type CanonicalPromptInput = {
  target: PromptTarget;
  style: PromptStyle;
  connection: SonarConnection;
  repositoryName?: string;
  generatedAt: string;
  source: PromptSource;
  issues?: SonarIssue[];
  coverageTargets?: SonarCoverageTarget[];
  duplicationTargets?: SonarDuplicationTarget[];
  hotspots?: SonarSecurityHotspot[];
};
