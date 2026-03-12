import { CanonicalPromptInput } from './types';
import {
  getSourceDeliverables,
  getSourceExecutionRules,
  getSourceHeading,
  renderSelectionList,
  renderSharedConstraints
} from './renderShared';

export function renderQwenPrompt(input: CanonicalPromptInput): string {
  return [
    getQwenIntro(input),
    '',
    getQwenGoal(input),
    '',
    getSourceHeading(input),
    renderSelectionList(input),
    '',
    renderSharedConstraints(input.style),
    '',
    'Execution rules:',
    ...getSourceExecutionRules(input),
    '',
    'Output contract:',
    ...getSourceDeliverables(input)
  ].join('\n');
}

function getQwenIntro(input: CanonicalPromptInput): string {
  switch (input.source) {
    case 'coverage':
      return 'Task: add tests for the selected coverage gaps in the current repository.';
    case 'duplication':
      return 'Task: reduce the selected code duplication in the current repository.';
    case 'hotspots':
      return 'Task: fix the selected security hotspots in the current repository.';
    case 'issues':
    default:
      return 'Task: fix the selected Sonar issues in the current repository.';
  }
}

function getQwenGoal(input: CanonicalPromptInput): string {
  switch (input.source) {
    case 'coverage':
      return `Primary goal: increase coverage for project "${input.connection.projectKey}" with targeted tests and minimal production edits.`;
    case 'duplication':
      return `Primary goal: reduce duplication for project "${input.connection.projectKey}" with low-risk, localized refactors.`;
    case 'hotspots':
      return `Primary goal: address the selected security hotspots for project "${input.connection.projectKey}" with low-risk, localized edits.`;
    case 'issues':
    default:
      return `Primary goal: address the findings for project "${input.connection.projectKey}" with low-risk, localized edits.`;
  }
}
