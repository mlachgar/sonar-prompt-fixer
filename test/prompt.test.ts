import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCanonicalPromptInput } from '../src/prompt/buildCanonicalPrompt';
import { renderClaudePrompt } from '../src/prompt/renderClaudePrompt';
import { renderCodexPrompt } from '../src/prompt/renderCodexPrompt';
import { renderPrompt } from '../src/prompt/renderPrompt';
import { renderQwenPrompt } from '../src/prompt/renderQwenPrompt';
import { renderIssueList, renderSharedConstraints } from '../src/prompt/renderShared';
import { SonarConnection, SonarIssue } from '../src/sonar/types';

const connection: SonarConnection = {
  type: 'cloud',
  baseUrl: 'https://sonarcloud.io',
  projectKey: 'acme_app',
  organization: 'acme'
};

const issues: SonarIssue[] = [
  {
    key: 'ISSUE-1',
    rule: 'typescript:S1111',
    message: 'Avoid this pattern.',
    severity: 'CRITICAL',
    type: 'BUG',
    status: 'OPEN',
    component: 'acme_app:src/main.ts',
    line: 18,
    effort: '15min',
    tags: ['pitfall', 'readability']
  },
  {
    key: 'ISSUE-2',
    rule: 'typescript:S2222',
    message: 'Second issue.',
    severity: 'MAJOR',
    type: 'CODE_SMELL',
    component: 'acme_app:src/secondary.ts'
  }
];

afterEach(() => {
  vi.useRealTimers();
});

describe('prompt helpers', () => {
  it('builds a canonical prompt with a deterministic timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T10:00:00.000Z'));

    expect(buildCanonicalPromptInput(issues, 'codex', 'balanced', connection)).toEqual({
      target: 'codex',
      style: 'balanced',
      connection,
      issues,
      generatedAt: '2026-03-12T10:00:00.000Z'
    });
  });

  it('renders the issue list with optional metadata only when present', () => {
    const output = renderIssueList({
      target: 'codex',
      style: 'balanced',
      connection,
      issues,
      generatedAt: '2026-03-12T10:00:00.000Z'
    });

    expect(output).toContain('1. [CRITICAL/BUG] typescript:S1111 at acme_app:src/main.ts:18 | status: OPEN | effort: 15min | tags: pitfall, readability');
    expect(output).toContain('2. [MAJOR/CODE_SMELL] typescript:S2222 at acme_app:src/secondary.ts');
    expect(output).not.toContain('ISSUE-2 | status:');
  });

  it('renders style-specific shared constraints', () => {
    expect(renderSharedConstraints('minimal')).toContain('Keep the response brief and execution-focused.');
    expect(renderSharedConstraints('balanced')).toContain('Balance concise execution with enough explanation to justify fixes.');
    expect(renderSharedConstraints('guided')).toContain('Explain reasoning where it helps, but keep changes localized and practical.');
  });
});

describe('target-specific prompt renderers', () => {
  const input = {
    target: 'codex' as const,
    style: 'guided' as const,
    connection,
    issues,
    generatedAt: '2026-03-12T10:00:00.000Z'
  };

  it('renders the codex prompt', () => {
    const output = renderCodexPrompt(input);
    expect(output).toContain('You are fixing Sonar issues in this repository.');
    expect(output).toContain('Goal: Resolve the selected Sonar findings for project "acme_app"');
    expect(output).toContain('Deliverables:');
  });

  it('renders the claude prompt', () => {
    const output = renderClaudePrompt(input);
    expect(output).toContain('Please remediate the selected Sonar findings in this codebase.');
    expect(output).toContain('Expected response:');
  });

  it('renders the qwen prompt', () => {
    const output = renderQwenPrompt(input);
    expect(output).toContain('Task: fix the selected Sonar issues in the current repository.');
    expect(output).toContain('Output contract:');
  });

  it('dispatches by target and defaults codex', () => {
    expect(renderPrompt({ ...input, target: 'claude' })).toContain('Please remediate');
    expect(renderPrompt({ ...input, target: 'qwen' })).toContain('Task: fix the selected Sonar issues');
    expect(renderPrompt({ ...input, target: 'codex' })).toContain('You are fixing Sonar issues');
  });
});
