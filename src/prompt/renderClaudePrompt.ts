import { CanonicalPromptInput } from './types';
import {
  getSourceDeliverables,
  getSourceExecutionRules,
  getSourceHeading,
  renderSelectionList,
  renderSharedConstraints
} from './renderShared';

export function renderClaudePrompt(input: CanonicalPromptInput): string {
  return [
    getClaudeIntro(input),
    '',
    getClaudeObjective(input),
    '',
    getSourceHeading(input),
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

function getClaudeIntro(input: CanonicalPromptInput): string {
  if (hasMixedSelections(input)) {
    return 'Please address the selected Sonar items across the active workspace modes in this codebase.';
  }

  switch (input.source) {
    case 'coverage':
      return 'Please improve test coverage for the selected code paths in this codebase.';
    case 'duplication':
      return 'Please reduce the selected code duplication in this codebase.';
    case 'hotspots':
      return 'Please remediate the selected security hotspots in this codebase.';
    case 'issues':
    default:
      return 'Please remediate the selected Sonar findings in this codebase.';
  }
}

function getClaudeObjective(input: CanonicalPromptInput): string {
  if (hasMixedSelections(input)) {
    return `Objective: address the selected Sonar issues, coverage gaps, duplication targets, and security hotspots for project "${input.connection.projectKey}" with precise, low-risk changes.`;
  }

  switch (input.source) {
    case 'coverage':
      return `Objective: produce focused tests for project "${input.connection.projectKey}" that cover the selected gaps while keeping production changes minimal.`;
    case 'duplication':
      return `Objective: produce precise refactors for project "${input.connection.projectKey}" that reduce duplication while preserving behavior and avoiding broad rewrites.`;
    case 'hotspots':
      return `Objective: produce precise security remediations for project "${input.connection.projectKey}" while preserving current behavior and avoiding opportunistic refactors.`;
    case 'issues':
    default:
      return `Objective: produce precise fixes for project "${input.connection.projectKey}" while preserving current behavior and avoiding opportunistic refactors.`;
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
