import { CanonicalPromptInput } from './types';
import {
  getSourceDeliverables,
  getSourceExecutionRules,
  getSourceHeading,
  hasMixedSelections,
  renderSelectionList,
  renderSharedConstraints
} from './renderShared';

export function renderQwenPrompt(input: CanonicalPromptInput): string {
  const heading = getSourceHeading(input);

  return [
    getQwenIntro(input),
    '',
    getQwenGoal(input),
    '',
    ...(heading ? [heading] : []),
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

function getRepositoryContext(input: CanonicalPromptInput): string {
  return input.repositoryName ? ` for project "${input.repositoryName}"` : '';
}

function getQwenIntro(input: CanonicalPromptInput): string {
  if (hasMixedSelections(input)) {
    return 'Task: improve this repository by fixing the selected Sonar findings.';
  }

  switch (input.source) {
    case 'coverage':
      return 'Task: add tests for the selected coverage gaps in this repository.';
    case 'duplication':
      return 'Task: reduce the selected code duplication in this repository.';
    case 'hotspots':
      return 'Task: fix the selected security hotspots in this repository.';
    case 'issues':
    default:
      return 'Task: fix the selected Sonar findings in this repository.';
  }
}

function getQwenGoal(input: CanonicalPromptInput): string {
  const repositoryContext = getRepositoryContext(input);

  if (hasMixedSelections(input)) {
    return `Primary goal: address the selected Sonar issues, coverage gaps, duplication targets, and security hotspots${repositoryContext} with low-risk, localized edits.`;
  }

  switch (input.source) {
    case 'coverage':
      return `Primary goal: increase coverage${repositoryContext} with targeted tests and minimal production edits.`;
    case 'duplication':
      return `Primary goal: reduce duplication${repositoryContext} with low-risk, localized refactors.`;
    case 'hotspots':
      return `Primary goal: address the selected security hotspots${repositoryContext} with low-risk, localized edits.`;
    case 'issues':
    default:
      return `Primary goal: address the findings${repositoryContext} with low-risk, localized edits.`;
  }
}
