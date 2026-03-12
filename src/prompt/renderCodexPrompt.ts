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
