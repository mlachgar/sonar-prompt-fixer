import { SonarConnection, SonarIssue } from '../sonar/types';

export type PromptTarget = 'codex' | 'claude' | 'qwen';
export type PromptStyle = 'minimal' | 'balanced' | 'guided';

export type CanonicalPromptInput = {
  target: PromptTarget;
  style: PromptStyle;
  connection: SonarConnection;
  issues: SonarIssue[];
  generatedAt: string;
};
