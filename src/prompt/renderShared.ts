import { CanonicalPromptInput } from './types';

export function renderIssueList(input: CanonicalPromptInput): string {
  return input.issues
    .map((issue, index) => {
      const location = issue.line ? `${issue.component}:${issue.line}` : issue.component;
      const tags = issue.tags && issue.tags.length > 0 ? ` | tags: ${issue.tags.join(', ')}` : '';
      const effort = issue.effort ? ` | effort: ${issue.effort}` : '';
      const status = issue.status ? ` | status: ${issue.status}` : '';
      return `${index + 1}. [${issue.severity}/${issue.type}] ${issue.rule} at ${location}${status}${effort}${tags}\n   ${issue.message}`;
    })
    .join('\n');
}

export function renderSharedConstraints(style: CanonicalPromptInput['style']): string {
  const styleLine = getStyleLine(style);

  return [
    'Constraints:',
    '- Preserve existing behavior unless a safe change is required to resolve an issue.',
    '- Prefer minimal, localized fixes over broad refactors.',
    '- Do not address unrelated code smells or style issues.',
    '- If a Sonar issue lacks enough context, inspect the referenced file before changing code.',
    '- End with a short summary grouped by file.',
    `- ${styleLine}`
  ].join('\n');
}

function getStyleLine(style: CanonicalPromptInput['style']): string {
  if (style === 'minimal') {
    return 'Keep the response brief and execution-focused.';
  }

  if (style === 'guided') {
    return 'Explain reasoning where it helps, but keep changes localized and practical.';
  }

  return 'Balance concise execution with enough explanation to justify fixes.';
}
