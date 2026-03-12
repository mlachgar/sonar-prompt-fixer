import { SonarConnection, SonarCoverageTarget, SonarDuplicationTarget, SonarIssue, SonarSecurityHotspot } from '../sonar/types';

export type PromptTarget = 'codex' | 'claude' | 'qwen';
export type PromptStyle = 'minimal' | 'balanced' | 'guided';
export type PromptSource = 'issues' | 'coverage' | 'duplication' | 'hotspots';

export type PromptSelection =
  | {
      source: 'issues';
      issues: SonarIssue[];
    }
  | {
      source: 'coverage';
      coverageTargets: SonarCoverageTarget[];
    }
  | {
      source: 'duplication';
      duplicationTargets: SonarDuplicationTarget[];
    }
  | {
      source: 'hotspots';
      hotspots: SonarSecurityHotspot[];
    };

export type CanonicalPromptInput = {
  target: PromptTarget;
  style: PromptStyle;
  connection: SonarConnection;
  generatedAt: string;
} & PromptSelection;
