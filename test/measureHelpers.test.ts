import { describe, expect, it } from 'vitest';
import {
  COVERAGE_METRICS,
  DUPLICATION_METRICS,
  KPI_METRICS,
  hasCoverageGap,
  hasDuplicationGap,
  mapCoverageTarget,
  mapDuplicationTarget,
  mapKpiSummary
} from '../src/sonar/measureHelpers';

describe('measureHelpers', () => {
  it('exports the expected metric key groups', () => {
    expect(COVERAGE_METRICS).toEqual([
      'coverage',
      'line_coverage',
      'branch_coverage',
      'lines_to_cover',
      'uncovered_lines',
      'conditions_to_cover',
      'uncovered_conditions'
    ]);
    expect(DUPLICATION_METRICS).toEqual([
      'duplicated_lines_density',
      'duplicated_lines',
      'duplicated_blocks'
    ]);
    expect(KPI_METRICS).toEqual(expect.arrayContaining([
      'coverage',
      'duplicated_lines_density',
      'security_review_rating'
    ]));
  });

  it('maps coverage targets and falls back to the component name when path is missing', () => {
    expect(mapCoverageTarget({
      key: 'proj:file',
      name: 'file.ts',
      measures: [
        { metric: 'coverage', value: '87.5' },
        { metric: 'line_coverage', value: '91' },
        { metric: 'branch_coverage', value: 'oops' },
        { metric: 'lines_to_cover', value: '12' },
        { metric: 'uncovered_lines', value: '2' },
        { metric: 'conditions_to_cover', value: '3' },
        { metric: 'uncovered_conditions', value: '1' }
      ]
    })).toEqual({
      key: 'proj:file',
      component: 'file.ts',
      path: 'file.ts',
      coverage: 87.5,
      lineCoverage: 91,
      branchCoverage: undefined,
      linesToCover: 12,
      uncoveredLines: 2,
      conditionsToCover: 3,
      uncoveredConditions: 1
    });
  });

  it('detects coverage gaps from uncovered lines or conditions and handles missing values', () => {
    expect(hasCoverageGap({
      key: 'a',
      component: 'a.ts',
      path: 'a.ts',
      uncoveredLines: 1
    })).toBe(true);

    expect(hasCoverageGap({
      key: 'b',
      component: 'b.ts',
      path: 'b.ts',
      uncoveredConditions: 2
    })).toBe(true);

    expect(hasCoverageGap({
      key: 'c',
      component: 'c.ts',
      path: 'c.ts',
      uncoveredLines: 0,
      uncoveredConditions: 0
    })).toBe(false);
  });

  it('maps duplication targets and parses invalid numeric values as undefined', () => {
    expect(mapDuplicationTarget({
      key: 'proj:dup',
      path: 'src/dup.ts',
      name: 'dup.ts',
      measures: [
        { metric: 'duplicated_lines_density', value: '5.5' },
        { metric: 'duplicated_lines', value: 'NaN-ish' },
        { metric: 'duplicated_blocks', value: '4' }
      ]
    })).toEqual({
      key: 'proj:dup',
      component: 'src/dup.ts',
      path: 'src/dup.ts',
      duplicatedLinesDensity: 5.5,
      duplicatedLines: undefined,
      duplicatedBlocks: 4
    });
  });

  it('detects duplication gaps across all tracked duplication metrics', () => {
    expect(hasDuplicationGap({
      key: 'a',
      component: 'a.ts',
      path: 'a.ts',
      duplicatedLines: 1
    })).toBe(true);

    expect(hasDuplicationGap({
      key: 'b',
      component: 'b.ts',
      path: 'b.ts',
      duplicatedBlocks: 1
    })).toBe(true);

    expect(hasDuplicationGap({
      key: 'c',
      component: 'c.ts',
      path: 'c.ts',
      duplicatedLinesDensity: 0.5
    })).toBe(true);

    expect(hasDuplicationGap({
      key: 'd',
      component: 'd.ts',
      path: 'd.ts',
      duplicatedLines: 0,
      duplicatedBlocks: 0,
      duplicatedLinesDensity: 0
    })).toBe(false);
  });

  it('maps KPI summaries and preserves non-numeric review ratings', () => {
    expect(mapKpiSummary([
      { metric: 'coverage', value: '80.1' },
      { metric: 'line_coverage', value: '79' },
      { metric: 'branch_coverage', value: 'bad-number' },
      { metric: 'duplicated_lines_density', value: '4.2' },
      { metric: 'duplicated_lines', value: '6' },
      { metric: 'duplicated_blocks', value: '2' },
      { metric: 'security_hotspots', value: '3' },
      { metric: 'security_hotspots_reviewed', value: '66.7' },
      { metric: 'security_review_rating', value: 'A' }
    ])).toEqual({
      coverage: 80.1,
      lineCoverage: 79,
      branchCoverage: undefined,
      duplicationDensity: 4.2,
      duplicatedLines: 6,
      duplicatedBlocks: 2,
      securityHotspots: 3,
      securityHotspotsReviewed: 66.7,
      securityReviewRating: 'A'
    });
  });

  it('treats empty metric strings as undefined', () => {
    expect(mapCoverageTarget({
      key: 'proj:empty',
      name: 'empty.ts',
      measures: [
        { metric: 'coverage', value: '' },
        { metric: 'uncovered_lines', value: '' }
      ]
    })).toEqual({
      key: 'proj:empty',
      component: 'empty.ts',
      path: 'empty.ts',
      coverage: undefined,
      lineCoverage: undefined,
      branchCoverage: undefined,
      linesToCover: undefined,
      uncoveredLines: undefined,
      conditionsToCover: undefined,
      uncoveredConditions: undefined
    });
  });
});
