import { CanonicalPromptInput } from './types';
import {
  getSourceDeliverables,
  getSourceExecutionRules,
  getSourceGoal,
  getSourceHeading,
  hasMixedSelections,
  renderSelectionList,
  renderSharedConstraints
} from './renderShared';

export function renderCodexPrompt(input: CanonicalPromptInput): string {
  const heading = getSourceHeading(input);

  return [
    getCodexIntro(input),
    '',
    getSourceGoal(input),
    '',
    ...(heading ? [heading] : []),
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
    return 'You are improving this repository by fixing the selected Sonar findings.';
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
      return 'You are fixing Sonar findings in this repository.';
  }
}
