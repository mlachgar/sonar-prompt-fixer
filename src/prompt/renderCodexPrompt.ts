import { CanonicalPromptInput } from './types';
import { renderIssueList, renderSharedConstraints } from './renderShared';

export function renderCodexPrompt(input: CanonicalPromptInput): string {
  return [
    'You are fixing Sonar issues in this repository.',
    '',
    `Goal: Resolve the selected Sonar findings for project "${input.connection.projectKey}" with minimal, safe code changes.`,
    '',
    'Selected issues:',
    renderIssueList(input),
    '',
    renderSharedConstraints(input.style),
    '',
    'Working agreement:',
    '- Inspect the referenced files before editing.',
    '- Make the smallest change that fully addresses each issue.',
    '- Call out any issue that cannot be resolved confidently from the available code.',
    '',
    'Deliverables:',
    '- Implement the fixes.',
    '- Summarize what changed by file.',
    '- Mention any remaining risks or follow-up items.'
  ].join('\n');
}
