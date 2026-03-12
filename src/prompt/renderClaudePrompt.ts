import { CanonicalPromptInput } from './types';
import { renderIssueList, renderSharedConstraints } from './renderShared';

export function renderClaudePrompt(input: CanonicalPromptInput): string {
  return [
    'Please remediate the selected Sonar findings in this codebase.',
    '',
    `Objective: produce precise fixes for project "${input.connection.projectKey}" while preserving current behavior and avoiding opportunistic refactors.`,
    '',
    'Findings to address:',
    renderIssueList(input),
    '',
    renderSharedConstraints(input.style),
    '',
    'Expected approach:',
    '- Review each referenced file before making edits.',
    '- Favor narrowly scoped changes that directly satisfy the Sonar finding.',
    '- If one change resolves multiple findings, keep it cohesive and explain the linkage.',
    '',
    'Expected response:',
    '- Implement the code changes.',
    '- Provide a concise summary organized by file.',
    '- Note any ambiguous findings that need human review.'
  ].join('\n');
}
