import { SonarCoverageTarget, SonarDuplicationTarget, SonarKpiSummary } from './types';

export type SonarMeasure = {
  metric: string;
  value?: string;
};

export type SonarMeasureComponent = {
  key: string;
  path?: string;
  name: string;
  measures?: SonarMeasure[];
};

export const COVERAGE_METRICS = [
  'coverage',
  'line_coverage',
  'branch_coverage',
  'lines_to_cover',
  'uncovered_lines',
  'conditions_to_cover',
  'uncovered_conditions'
];

export const KPI_METRICS = [
  'coverage',
  'line_coverage',
  'branch_coverage',
  'duplicated_lines_density',
  'duplicated_lines',
  'duplicated_blocks',
  'security_hotspots',
  'security_hotspots_reviewed',
  'security_review_rating'
];

export const DUPLICATION_METRICS = [
  'duplicated_lines_density',
  'duplicated_lines',
  'duplicated_blocks'
];

export function mapCoverageTarget(component: SonarMeasureComponent): SonarCoverageTarget {
  const path = component.path ?? component.name;
  const metrics = new Map((component.measures ?? []).map((measure) => [measure.metric, measure.value]));

  return {
    key: component.key,
    component: path,
    path,
    coverage: parseNumber(metrics.get('coverage')),
    lineCoverage: parseNumber(metrics.get('line_coverage')),
    branchCoverage: parseNumber(metrics.get('branch_coverage')),
    linesToCover: parseNumber(metrics.get('lines_to_cover')),
    uncoveredLines: parseNumber(metrics.get('uncovered_lines')),
    conditionsToCover: parseNumber(metrics.get('conditions_to_cover')),
    uncoveredConditions: parseNumber(metrics.get('uncovered_conditions'))
  };
}

export function hasCoverageGap(target: SonarCoverageTarget): boolean {
  return (target.uncoveredLines ?? 0) > 0 || (target.uncoveredConditions ?? 0) > 0;
}

export function mapDuplicationTarget(component: SonarMeasureComponent): SonarDuplicationTarget {
  const path = component.path ?? component.name;
  const metrics = new Map((component.measures ?? []).map((measure) => [measure.metric, measure.value]));

  return {
    key: component.key,
    component: path,
    path,
    duplicatedLinesDensity: parseNumber(metrics.get('duplicated_lines_density')),
    duplicatedLines: parseNumber(metrics.get('duplicated_lines')),
    duplicatedBlocks: parseNumber(metrics.get('duplicated_blocks'))
  };
}

export function hasDuplicationGap(target: SonarDuplicationTarget): boolean {
  return (target.duplicatedLines ?? 0) > 0 || (target.duplicatedBlocks ?? 0) > 0 || (target.duplicatedLinesDensity ?? 0) > 0;
}

export function mapKpiSummary(measures: SonarMeasure[]): SonarKpiSummary {
  const metrics = new Map(measures.map((measure) => [measure.metric, measure.value]));

  return {
    coverage: parseNumber(metrics.get('coverage')),
    lineCoverage: parseNumber(metrics.get('line_coverage')),
    branchCoverage: parseNumber(metrics.get('branch_coverage')),
    duplicationDensity: parseNumber(metrics.get('duplicated_lines_density')),
    duplicatedLines: parseNumber(metrics.get('duplicated_lines')),
    duplicatedBlocks: parseNumber(metrics.get('duplicated_blocks')),
    securityHotspots: parseNumber(metrics.get('security_hotspots')),
    securityHotspotsReviewed: parseNumber(metrics.get('security_hotspots_reviewed')),
    securityReviewRating: metrics.get('security_review_rating')
  };
}

function parseNumber(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}
