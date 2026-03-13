import { CanonicalPromptInput } from './types';
import {
  getSourceDeliverables,
  getSourceExecutionRules,
  getSourceHeading,
  hasMixedSelections,
  renderSelectionList,
  renderSharedConstraints
} from './renderShared';

export function renderClaudePrompt(input: CanonicalPromptInput): string {
  const heading = getSourceHeading(input);

  return [
    getClaudeIntro(input),
    '',
    getClaudeObjective(input),
    '',
    ...(heading ? [heading] : []),
    renderSelectionList(input),
    '',
    renderSharedConstraints(input.style),
    '',
    'Expected approach:',
    ...getSourceExecutionRules(input),
    '',
    'Expected response:',
    ...getSourceDeliverables(input)
  ].join('\n');
}

function getRepositoryContext(input: CanonicalPromptInput): string {
  return input.repositoryName ? ` for workspace "${input.repositoryName}"` : '';
}

function getClaudeIntro(input: CanonicalPromptInput): string {
  if (hasMixedSelections(input)) {
    return 'Please improve this repository by fixing the selected Sonar findings.';
  }

  switch (input.source) {
    case 'coverage':
      return 'Please improve test coverage for the selected code paths in this repository.';
    case 'duplication':
      return 'Please reduce the selected code duplication in this repository.';
    case 'hotspots':
      return 'Please remediate the selected security hotspots in this repository.';
    case 'issues':
    default:
      return 'Please remediate the selected Sonar findings in this repository.';
  }
}

function getClaudeObjective(input: CanonicalPromptInput): string {
  const repositoryContext = getRepositoryContext(input);

  if (hasMixedSelections(input)) {
    return `Objective: address the selected Sonar issues, coverage gaps, duplication targets, and security hotspots${repositoryContext} with precise, low-risk changes.`;
  }

  switch (input.source) {
    case 'coverage':
      return `Objective: produce focused tests${repositoryContext} that cover the selected gaps while keeping production changes minimal.`;
    case 'duplication':
      return `Objective: produce precise refactors${repositoryContext} that reduce duplication while preserving behavior and avoiding broad rewrites.`;
    case 'hotspots':
      return `Objective: produce precise security remediations${repositoryContext} while preserving current behavior and avoiding opportunistic refactors.`;
    case 'issues':
    default:
      return `Objective: produce precise fixes${repositoryContext} while preserving current behavior and avoiding opportunistic refactors.`;
  }
}
