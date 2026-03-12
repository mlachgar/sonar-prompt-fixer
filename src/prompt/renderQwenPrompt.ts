import { CanonicalPromptInput } from './types';
import { renderIssueList, renderSharedConstraints } from './renderShared';

export function renderQwenPrompt(input: CanonicalPromptInput): string {
  return [
    'Task: fix the selected Sonar issues in the current repository.',
    '',
    `Primary goal: address the findings for project "${input.connection.projectKey}" with low-risk, localized edits.`,
    '',
    'Issue set:',
    renderIssueList(input),
    '',
    renderSharedConstraints(input.style),
    '',
    'Execution rules:',
    '- Read the impacted code paths before changing them.',
    '- Keep edits tightly scoped to the listed issues.',
    '- Avoid unrelated cleanup or restructuring.',
    '',
    'Output contract:',
    '- Apply the fixes.',
    '- Report the final changes by file.',
    '- Mention anything still unresolved.'
  ].join('\n');
}
