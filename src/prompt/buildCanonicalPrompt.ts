import { CanonicalPromptInput, PromptSelection, PromptStyle, PromptTarget } from './types';
import { SonarConnection } from '../sonar/types';

export function buildCanonicalPromptInput(
  selection: PromptSelection,
  target: PromptTarget,
  style: PromptStyle,
  connection: SonarConnection
): CanonicalPromptInput {
  return {
    target,
    style,
    connection,
    ...selection,
    generatedAt: new Date().toISOString()
  };
}
