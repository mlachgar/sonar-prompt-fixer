import { CanonicalPromptInput, PromptStyle, PromptTarget } from './types';
import { SonarConnection, SonarIssue } from '../sonar/types';

export function buildCanonicalPromptInput(
  issues: SonarIssue[],
  target: PromptTarget,
  style: PromptStyle,
  connection: SonarConnection
): CanonicalPromptInput {
  return {
    target,
    style,
    connection,
    issues,
    generatedAt: new Date().toISOString()
  };
}
