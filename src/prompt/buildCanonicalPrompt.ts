import { CanonicalPromptInput, PromptSelection, PromptStyle, PromptTarget } from './types';
import { SonarConnection } from '../sonar/types';

export function buildCanonicalPromptInput(
  selection: PromptSelection,
  target: PromptTarget,
  style: PromptStyle,
  connection: SonarConnection,
  repositoryName?: string
): CanonicalPromptInput {
  return {
    target,
    style,
    connection,
    repositoryName,
    source: selection.source,
    issues: selection.issues ?? [],
    coverageTargets: selection.coverageTargets ?? [],
    duplicationTargets: selection.duplicationTargets ?? [],
    hotspots: selection.hotspots ?? [],
    generatedAt: new Date().toISOString()
  };
}
