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
    source: selection.source,
    issues: selection.issues ?? [],
    coverageTargets: selection.coverageTargets ?? [],
    duplicationTargets: selection.duplicationTargets ?? [],
    hotspots: selection.hotspots ?? [],
    generatedAt: new Date().toISOString()
  };
}
