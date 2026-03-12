import { CanonicalPromptInput } from './types';
import {
  getSourceDeliverables,
  getSourceExecutionRules,
  getSourceGoal,
  getSourceHeading,
  renderSelectionList,
  renderSharedConstraints
} from './renderShared';

export function renderCodexPrompt(input: CanonicalPromptInput): string {
  return [
    getCodexIntro(input),
    '',
    getSourceGoal(input),
    '',
    getSourceHeading(input),
    renderSelectionList(input),
    '',
    renderSharedConstraints(input.style),
    '',
    'Working agreement:',
    ...getSourceExecutionRules(input),
    '',
    'Deliverables:',
    ...getSourceDeliverables(input)
  ].join('\n');
}

function getCodexIntro(input: CanonicalPromptInput): string {
  if (hasMixedSelections(input)) {
    return 'You are addressing selected Sonar items across multiple workspace modes in this repository.';
  }

  switch (input.source) {
    case 'coverage':
      return 'You are improving test coverage in this repository.';
    case 'duplication':
      return 'You are reducing code duplication in this repository.';
    case 'hotspots':
      return 'You are remediating security hotspots in this repository.';
    case 'issues':
    default:
      return 'You are fixing Sonar issues in this repository.';
  }
}

function hasMixedSelections(input: CanonicalPromptInput): boolean {
  return (input.issues?.length ?? 0) > 0 &&
    ((input.coverageTargets?.length ?? 0) > 0 ||
      (input.duplicationTargets?.length ?? 0) > 0 ||
      (input.hotspots?.length ?? 0) > 0) ||
    ((input.coverageTargets?.length ?? 0) > 0 &&
      ((input.duplicationTargets?.length ?? 0) > 0 || (input.hotspots?.length ?? 0) > 0)) ||
    ((input.duplicationTargets?.length ?? 0) > 0 && (input.hotspots?.length ?? 0) > 0);
}
