import { CanonicalPromptInput } from './types';

export function renderSelectionList(input: CanonicalPromptInput): string {
  const sections = getSelectionSections(input);
  if (sections.length <= 1) {
    return sections[0]?.body ?? '';
  }

  return sections.map((section) => `${section.heading}\n${section.body}`).join('\n\n');
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

export function getSourceGoal(input: CanonicalPromptInput): string {
  const repositoryContext = getRepositoryContext(input);

  if (hasMixedSelections(input)) {
    return `Goal: Address the selected Sonar items${repositoryContext} across issues, coverage, duplication, and security hotspots with minimal, safe code changes.`;
  }

  switch (getPrimarySource(input)) {
    case 'coverage':
      return `Goal: Add tests${repositoryContext} that cover the selected uncovered lines and branches with minimal production-code changes.`;
    case 'duplication':
      return `Goal: Reduce the selected code duplications${repositoryContext} with minimal, safe refactors that preserve behavior.`;
    case 'hotspots':
      return `Goal: Review and remediate the selected security hotspots${repositoryContext} with minimal, safe code changes.`;
    case 'issues':
    default:
      return `Goal: Resolve the folowing Sonar findings${repositoryContext} with minimal, safe code changes.`;
  }
}

export function getSourceHeading(input: CanonicalPromptInput): string {
  if (hasMixedSelections(input)) {
    return '';
  }

  switch (getPrimarySource(input)) {
    case 'coverage':
      return 'Coverage to fix:';
    case 'duplication':
      return 'Duplication to fix:';
    case 'hotspots':
      return 'Security hotspots to fix:';
    case 'issues':
    default:
      return 'Issues to fix:';
  }
}

export function getSourceExecutionRules(input: CanonicalPromptInput): string[] {
  if (hasMixedSelections(input)) {
    return dedupeLines(getActiveSources(input).flatMap((source) => getRulesForSource(source)));
  }

  switch (getPrimarySource(input)) {
    case 'coverage':
      return [
        '- Inspect the referenced files and existing tests before editing.',
        '- Prefer adding or extending tests over changing production logic.',
        '- If small production changes are required for testability, keep them minimal and justified.'
      ];
    case 'duplication':
      return [
        '- Inspect the duplicated code paths before editing.',
        '- Prefer small extractions or shared helpers over broad architectural rewrites.',
        '- Preserve behavior and call out any duplication that should remain for clarity or safety.'
      ];
    case 'hotspots':
      return [
        '- Inspect the risky code path before editing.',
        '- Preserve behavior while removing or reducing the security risk.',
        '- Call out any hotspot that still needs human security review.'
      ];
    case 'issues':
    default:
      return [
        '- Inspect the referenced files before editing.',
        '- Make the smallest change that fully addresses each issue.',
        '- Call out any issue that cannot be resolved confidently from the available code.'
      ];
  }
}

export function getSourceDeliverables(input: CanonicalPromptInput): string[] {
  if (hasMixedSelections(input)) {
    return dedupeLines(getActiveSources(input).flatMap((source) => getDeliverablesForSource(source)));
  }

  switch (getPrimarySource(input)) {
    case 'coverage':
      return [
        '- Add or update tests to improve coverage.',
        '- Summarize what changed by file.',
        '- Mention any remaining uncovered logic that could not be tested safely.'
      ];
    case 'duplication':
      return [
        '- Implement the duplication reduction changes.',
        '- Summarize what changed by file.',
        '- Mention any remaining duplication that should be kept or deferred.'
      ];
    case 'hotspots':
      return [
        '- Implement the remediation changes.',
        '- Summarize what changed by file.',
        '- Mention any remaining risks or follow-up security review items.'
      ];
    case 'issues':
    default:
      return [
        '- Implement the fixes.',
        '- Summarize what changed by file.',
        '- Mention any remaining risks or follow-up items.'
      ];
  }
}

function formatPercent(value?: number): string {
  return value === undefined ? 'n/a' : `${value}%`;
}

function getRepositoryContext(input: CanonicalPromptInput): string {
  return input.repositoryName ? ` for project "${input.repositoryName}"` : '';
}

function formatNumber(value?: number): string {
  return value === undefined ? 'n/a' : `${value}`;
}

function describeCoverageFocus(uncoveredLines?: number, uncoveredConditions?: number): string {
  const focusParts: string[] = [];

  if ((uncoveredLines ?? 0) > 0) {
    focusParts.push(`${uncoveredLines} uncovered lines`);
  }

  if ((uncoveredConditions ?? 0) > 0) {
    focusParts.push(`${uncoveredConditions} uncovered branch conditions`);
  }

  if (focusParts.length === 0) {
    return 'Add focused tests for the remaining coverage gaps in this file.';
  }

  return `Add focused tests to cover ${focusParts.join(' and ')}.`;
}

function describeDuplicationFocus(duplicatedLines?: number, duplicatedBlocks?: number): string {
  const focusParts: string[] = [];

  if ((duplicatedLines ?? 0) > 0) {
    focusParts.push(`${duplicatedLines} duplicated lines`);
  }

  if ((duplicatedBlocks ?? 0) > 0) {
    focusParts.push(`${duplicatedBlocks} duplicated blocks`);
  }

  if (focusParts.length === 0) {
    return 'Refactor the remaining duplicated logic in the smallest safe way.';
  }

  return `Refactor to reduce ${focusParts.join(' and ')} while preserving behavior.`;
}

function getSelectionSections(input: CanonicalPromptInput): Array<{ source: string; heading: string; body: string }> {
  const orderedSources = [input.source, ...ALL_SOURCES.filter((source) => source !== input.source)];
  const seen = new Set<string>();
  const sections: Array<{ source: string; heading: string; body: string }> = [];

  for (const source of orderedSources) {
    if (seen.has(source)) {
      continue;
    }
    seen.add(source);

    const body = renderSingleSourceSelectionList(input, source);
    if (body) {
      sections.push({
        source,
        heading: getHeadingForSource(source),
        body
      });
    }
  }

  return sections;
}

function renderSingleSourceSelectionList(input: CanonicalPromptInput, source: string): string {
  switch (source) {
    case 'coverage':
      return (input.coverageTargets ?? [])
        .map((target, index) => {
          const coverage = formatPercent(target.coverage);
          const lineCoverage = formatPercent(target.lineCoverage);
          const branchCoverage = formatPercent(target.branchCoverage);
          const coverageFocus = describeCoverageFocus(target.uncoveredLines, target.uncoveredConditions);

          return `${index + 1}. ${target.path} | coverage: ${coverage} | line coverage: ${lineCoverage} | branch coverage: ${branchCoverage}\n   ${coverageFocus}`;
        })
        .join('\n');
    case 'duplication':
      return (input.duplicationTargets ?? [])
        .map((target, index) => {
          const duplicationDensity = formatPercent(target.duplicatedLinesDensity);
          const focus = describeDuplicationFocus(target.duplicatedLines, target.duplicatedBlocks);

          return `${index + 1}. ${target.path} | duplication: ${duplicationDensity} | duplicated lines: ${formatNumber(target.duplicatedLines)} | duplicated blocks: ${formatNumber(target.duplicatedBlocks)}\n   ${focus}`;
        })
        .join('\n');
    case 'hotspots':
      return (input.hotspots ?? [])
        .map((hotspot, index) => {
          const location = hotspot.line ? `${hotspot.component}:${hotspot.line}` : hotspot.component;
          const probability = hotspot.vulnerabilityProbability ? ` | probability: ${hotspot.vulnerabilityProbability}` : '';
          const status = hotspot.status ? ` | status: ${hotspot.status}` : '';

          return `${index + 1}. ${location}${status}${probability}\n   ${hotspot.message}`;
        })
        .join('\n');
    case 'issues':
    default:
      return (input.issues ?? [])
        .map((issue, index) => {
          const location = issue.line ? `${issue.component}:${issue.line}` : issue.component;
          const tags = issue.tags && issue.tags.length > 0 ? ` | tags: ${issue.tags.join(', ')}` : '';
          const effort = issue.effort ? ` | effort: ${issue.effort}` : '';
          const status = issue.status ? ` | status: ${issue.status}` : '';
          return `${index + 1}. [${issue.severity}/${issue.type}] ${issue.rule} at ${location}${status}${effort}${tags}\n   ${issue.message}`;
        })
        .join('\n');
  }
}

export function hasMixedSelections(input: CanonicalPromptInput): boolean {
  return getActiveSources(input).length > 1;
}

function getPrimarySource(input: CanonicalPromptInput): string {
  return getActiveSources(input)[0] ?? input.source;
}

function getActiveSources(input: CanonicalPromptInput): string[] {
  const sections = getSelectionSections(input);
  return sections.map((section) => section.source);
}

function getHeadingForSource(source: string): string {
  switch (source) {
    case 'coverage':
      return 'Coverage to fix:';
    case 'duplication':
      return 'Duplication to fix:';
    case 'hotspots':
      return 'Security hotspots to fix:';
    case 'issues':
    default:
      return 'Issues to fix:';
  }
}

function getRulesForSource(source: string): string[] {
  switch (source) {
    case 'coverage':
      return [
        '- Inspect the referenced files and existing tests before editing.',
        '- Prefer adding or extending tests over changing production logic.',
        '- If small production changes are required for testability, keep them minimal and justified.'
      ];
    case 'duplication':
      return [
        '- Inspect the duplicated code paths before editing.',
        '- Prefer small extractions or shared helpers over broad architectural rewrites.',
        '- Preserve behavior and call out any duplication that should remain for clarity or safety.'
      ];
    case 'hotspots':
      return [
        '- Inspect the risky code path before editing.',
        '- Preserve behavior while removing or reducing the security risk.',
        '- Call out any hotspot that still needs human security review.'
      ];
    case 'issues':
    default:
      return [
        '- Inspect the referenced files before editing.',
        '- Make the smallest change that fully addresses each issue.',
        '- Call out any issue that cannot be resolved confidently from the available code.'
      ];
  }
}

function getDeliverablesForSource(source: string): string[] {
  switch (source) {
    case 'coverage':
      return [
        '- Add or update tests to improve coverage.',
        '- Summarize what changed by file.',
        '- Mention any remaining uncovered logic that could not be tested safely.'
      ];
    case 'duplication':
      return [
        '- Implement the duplication reduction changes.',
        '- Summarize what changed by file.',
        '- Mention any remaining duplication that should be kept or deferred.'
      ];
    case 'hotspots':
      return [
        '- Implement the remediation changes.',
        '- Summarize what changed by file.',
        '- Mention any remaining risks or follow-up security review items.'
      ];
    case 'issues':
    default:
      return [
        '- Implement the fixes.',
        '- Summarize what changed by file.',
        '- Mention any remaining risks or follow-up items.'
      ];
  }
}

function dedupeLines(lines: string[]): string[] {
  return [...new Set(lines)];
}

const ALL_SOURCES = ['issues', 'coverage', 'duplication', 'hotspots'] as const;
