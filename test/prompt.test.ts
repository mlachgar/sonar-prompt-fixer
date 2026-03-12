import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCanonicalPromptInput } from '../src/prompt/buildCanonicalPrompt';
import { renderClaudePrompt } from '../src/prompt/renderClaudePrompt';
import { renderCodexPrompt } from '../src/prompt/renderCodexPrompt';
import { renderPrompt } from '../src/prompt/renderPrompt';
import { renderQwenPrompt } from '../src/prompt/renderQwenPrompt';
import {
  getSourceDeliverables,
  getSourceExecutionRules,
  getSourceGoal,
  getSourceHeading,
  renderSelectionList,
  renderSharedConstraints
} from '../src/prompt/renderShared';
import { SonarConnection, SonarCoverageTarget, SonarDuplicationTarget, SonarIssue, SonarSecurityHotspot } from '../src/sonar/types';

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

    expect(buildCanonicalPromptInput({ source: 'issues', issues }, 'codex', 'balanced', connection)).toEqual({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'issues',
      issues,
      generatedAt: '2026-03-12T10:00:00.000Z'
    });
  });

  it('renders the issue list with optional metadata only when present', () => {
    const output = renderSelectionList({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'issues',
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

  it('renders coverage, duplication, and hotspot selections', () => {
    const coverageTargets: SonarCoverageTarget[] = [{
      key: 'cov-1',
      component: 'acme_app:src/main.ts',
      path: 'src/main.ts',
      coverage: 50,
      lineCoverage: 60,
      branchCoverage: 40,
      uncoveredLines: 4,
      uncoveredConditions: 2
    }];
    const hotspots: SonarSecurityHotspot[] = [{
      key: 'hs-1',
      component: 'acme_app:src/auth.ts',
      line: 42,
      message: 'Review this risky authentication code path.',
      status: 'TO_REVIEW',
      vulnerabilityProbability: 'HIGH'
    }];
    const duplicationTargets: SonarDuplicationTarget[] = [{
      key: 'dup-1',
      component: 'acme_app:src/shared.ts',
      path: 'src/shared.ts',
      duplicatedLinesDensity: 22.5,
      duplicatedLines: 18,
      duplicatedBlocks: 3
    }];

    expect(renderSelectionList({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'coverage',
      coverageTargets,
      generatedAt: '2026-03-12T10:00:00.000Z'
    })).toContain('src/main.ts | coverage: 50% | line coverage: 60% | branch coverage: 40%');

    expect(renderSelectionList({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'duplication',
      duplicationTargets,
      generatedAt: '2026-03-12T10:00:00.000Z'
    })).toContain('src/shared.ts | duplication: 22.5% | duplicated lines: 18 | duplicated blocks: 3');

    expect(renderSelectionList({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'duplication',
      duplicationTargets: [{
        key: 'dup-2',
        component: 'acme_app:src/copy.ts',
        path: 'src/copy.ts'
      }],
      generatedAt: '2026-03-12T10:00:00.000Z'
    })).toContain('Refactor the remaining duplicated logic in the smallest safe way.');

    expect(renderSelectionList({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'hotspots',
      hotspots,
      generatedAt: '2026-03-12T10:00:00.000Z'
    })).toContain('acme_app:src/auth.ts:42 | status: TO_REVIEW | probability: HIGH');

    expect(renderSelectionList({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'coverage',
      coverageTargets: [{
        key: 'cov-2',
        component: 'acme_app:src/secondary.ts',
        path: 'src/secondary.ts'
      }],
      generatedAt: '2026-03-12T10:00:00.000Z'
    })).toContain('Add focused tests for the remaining coverage gaps in this file.');

    expect(renderSelectionList({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'coverage',
      coverageTargets: [{
        key: 'cov-3',
        component: 'acme_app:src/branches.ts',
        path: 'src/branches.ts',
        uncoveredLines: 0,
        uncoveredConditions: 1
      }],
      generatedAt: '2026-03-12T10:00:00.000Z'
    })).toContain('Add focused tests to cover 1 uncovered branch conditions.');

    expect(renderSelectionList({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'hotspots',
      hotspots: [{
        key: 'hs-2',
        component: 'acme_app:src/crypto.ts',
        message: 'Review crypto usage.'
      }],
      generatedAt: '2026-03-12T10:00:00.000Z'
    })).toContain('1. acme_app:src/crypto.ts\n   Review crypto usage.');
  });

  it('returns source-specific goals', () => {
    expect(getSourceGoal({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'coverage',
      coverageTargets: [],
      generatedAt: '2026-03-12T10:00:00.000Z'
    })).toContain('Add tests');
    expect(getSourceGoal({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'duplication',
      duplicationTargets: [],
      generatedAt: '2026-03-12T10:00:00.000Z'
    })).toContain('Reduce the selected code duplications');
    expect(getSourceGoal({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'hotspots',
      hotspots: [],
      generatedAt: '2026-03-12T10:00:00.000Z'
    })).toContain('security hotspots');
  });

  it('returns source-specific headings, execution rules, and deliverables', () => {
    expect(getSourceHeading({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'coverage',
      coverageTargets: [],
      generatedAt: '2026-03-12T10:00:00.000Z'
    })).toBe('Coverage targets:');
    expect(getSourceHeading({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'duplication',
      duplicationTargets: [],
      generatedAt: '2026-03-12T10:00:00.000Z'
    })).toBe('Duplication targets:');
    expect(getSourceHeading({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'hotspots',
      hotspots: [],
      generatedAt: '2026-03-12T10:00:00.000Z'
    })).toBe('Security hotspots to address:');
    expect(getSourceExecutionRules({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'duplication',
      duplicationTargets: [],
      generatedAt: '2026-03-12T10:00:00.000Z'
    })[0]).toContain('duplicated code paths');
    expect(getSourceExecutionRules({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'hotspots',
      hotspots: [],
      generatedAt: '2026-03-12T10:00:00.000Z'
    })[0]).toContain('risky code path');
    expect(getSourceDeliverables({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'duplication',
      duplicationTargets: [],
      generatedAt: '2026-03-12T10:00:00.000Z'
    })[0]).toContain('duplication reduction changes');
    expect(getSourceDeliverables({
      target: 'codex',
      style: 'balanced',
      connection,
      source: 'coverage',
      coverageTargets: [],
      generatedAt: '2026-03-12T10:00:00.000Z'
    })[0]).toContain('Add or update tests');
  });
});

describe('target-specific prompt renderers', () => {
  const input = {
    target: 'codex' as const,
    style: 'guided' as const,
    connection,
    source: 'issues' as const,
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

  it('renders source-specific prompts for coverage and hotspots', () => {
    const coverageInput = {
      target: 'codex' as const,
      style: 'guided' as const,
      connection,
      source: 'coverage' as const,
      coverageTargets: [{
        key: 'cov-1',
        component: 'acme_app:src/main.ts',
        path: 'src/main.ts',
        coverage: 50,
        lineCoverage: 60,
        branchCoverage: 40,
        uncoveredLines: 4,
        uncoveredConditions: 2
      }],
      generatedAt: '2026-03-12T10:00:00.000Z'
    };
    const hotspotInput = {
      target: 'claude' as const,
      style: 'guided' as const,
      connection,
      source: 'hotspots' as const,
      hotspots: [{
        key: 'hs-1',
        component: 'acme_app:src/auth.ts',
        line: 42,
        message: 'Review risky auth flow.',
        status: 'TO_REVIEW',
        vulnerabilityProbability: 'HIGH'
      }],
      generatedAt: '2026-03-12T10:00:00.000Z'
    };
    const duplicationInput = {
      target: 'qwen' as const,
      style: 'guided' as const,
      connection,
      source: 'duplication' as const,
      duplicationTargets: [{
        key: 'dup-1',
        component: 'acme_app:src/shared.ts',
        path: 'src/shared.ts',
        duplicatedLinesDensity: 22.5,
        duplicatedLines: 18,
        duplicatedBlocks: 3
      }],
      generatedAt: '2026-03-12T10:00:00.000Z'
    };

    expect(renderCodexPrompt(coverageInput)).toContain('improving test coverage');
    expect(renderCodexPrompt(coverageInput)).toContain('Add or update tests to improve coverage.');
    expect(renderClaudePrompt(coverageInput)).toContain('Please improve test coverage');
    expect(renderClaudePrompt(coverageInput)).toContain('focused tests');
    expect(renderQwenPrompt(coverageInput)).toContain('add tests for the selected coverage gaps');
    expect(renderQwenPrompt(coverageInput)).toContain('increase coverage');
    expect(renderClaudePrompt(hotspotInput)).toContain('selected security hotspots');
    expect(renderClaudePrompt(hotspotInput)).toContain('remaining risks or follow-up security review items');
    expect(renderCodexPrompt({ ...duplicationInput, target: 'codex' })).toContain('reducing code duplication');
    expect(renderClaudePrompt({ ...duplicationInput, target: 'claude' })).toContain('reduce the selected code duplication');
    expect(renderQwenPrompt(duplicationInput)).toContain('reduce the selected code duplication');
    expect(renderCodexPrompt({ ...hotspotInput, target: 'codex' })).toContain('remediating security hotspots');
    expect(renderQwenPrompt({ ...hotspotInput, target: 'qwen' })).toContain('fix the selected security hotspots');
  });
});
