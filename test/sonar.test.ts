import { describe, expect, it, vi } from 'vitest';
import { createSonarBackend } from '../src/sonar/SonarBackendFactory';
import { SonarCloudBackend } from '../src/sonar/SonarCloudBackend';
import { SonarQubeServerBackend } from '../src/sonar/SonarQubeServerBackend';
import { mapIssue, mapRule } from '../src/sonar/mappers';
import { HttpError, ConfigurationError } from '../src/util/errors';
import { SonarConnection } from '../src/sonar/types';

function mockClient(overrides: Record<string, unknown>) {
  return {
    getJson: vi.fn(),
    getText: vi.fn(),
    ...overrides
  };
}

const cloudConnection: SonarConnection = {
  type: 'cloud',
  baseUrl: 'https://sonarcloud.io',
  projectKey: 'proj',
  organization: 'org',
  branch: 'main',
  pullRequest: '42'
};

const serverConnection: SonarConnection = {
  type: 'server',
  baseUrl: 'https://sonar.example.com',
  projectKey: 'proj',
  branch: 'main',
  pullRequest: '42',
  authMode: 'basicToken'
};

describe('Sonar backend factory and mappers', () => {
  it('validates required connection settings and token presence', () => {
    expect(() => createSonarBackend({ ...cloudConnection, baseUrl: '', projectKey: '' }, 'token')).toThrow(ConfigurationError);
    expect(() => createSonarBackend(cloudConnection, undefined)).toThrow('No Sonar token is stored yet.');
    expect(createSonarBackend(cloudConnection, 'token')).toBeInstanceOf(SonarCloudBackend);
    expect(createSonarBackend(serverConnection, 'token')).toBeInstanceOf(SonarQubeServerBackend);
  });

  it('maps issues and rules into normalized objects', () => {
    expect(mapIssue({
      key: '1',
      rule: 'typescript:S1',
      message: 'Issue',
      severity: 'MAJOR',
      type: 'CODE_SMELL',
      component: 'proj:src/file.ts'
    })).toEqual({
      key: '1',
      rule: 'typescript:S1',
      message: 'Issue',
      severity: 'MAJOR',
      type: 'CODE_SMELL',
      status: undefined,
      component: 'proj:src/file.ts',
      line: undefined,
      effort: undefined,
      tags: []
    });

    expect(mapRule({
      key: 'typescript:S1',
      name: 'Rule name',
      severity: 'CRITICAL',
      type: 'BUG',
      htmlDesc: '<p>desc</p>'
    })).toEqual({
      key: 'typescript:S1',
      name: 'Rule name',
      severity: 'CRITICAL',
      type: 'BUG',
      htmlDesc: '<p>desc</p>'
    });
  });
});

describe('SonarCloudBackend', () => {
  it('tests the connection successfully', async () => {
    const backend = new SonarCloudBackend(cloudConnection, 'token');
    const client = mockClient({
      getJson: vi.fn()
        .mockResolvedValueOnce({ valid: true })
        .mockResolvedValueOnce({ component: { key: 'proj', name: 'Project' } })
    });
    (backend as any).httpClient = client;

    await expect(backend.testConnection()).resolves.toEqual({
      ok: true,
      kind: 'success',
      message: 'Connection succeeded and the configured project is accessible.'
    });
  });

  it('maps connection failures through diagnostics', async () => {
    const backend = new SonarCloudBackend(cloudConnection, 'token');
    (backend as any).httpClient = mockClient({
      getJson: vi.fn().mockRejectedValue(new HttpError('Forbidden', 403, 'denied'))
    });

    await expect(backend.testConnection()).resolves.toMatchObject({
      ok: false,
      kind: 'auth',
      details: 'denied'
    });
  });

  it('fetches issues, rules, project info, and capabilities', async () => {
    const backend = new SonarCloudBackend(cloudConnection, 'token');
    const client = mockClient({
      getJson: vi.fn()
        .mockResolvedValueOnce({
          issues: [{
            key: '1',
            rule: 'typescript:S1',
            message: 'Issue',
            severity: 'MAJOR',
            type: 'CODE_SMELL',
            component: 'proj:src/file.ts',
            tags: ['tag']
          }]
        })
        .mockResolvedValueOnce({
          components: [{
            key: 'proj:src/file.ts',
            path: 'src/file.ts',
            name: 'file.ts',
            measures: [
              { metric: 'coverage', value: '55.5' },
              { metric: 'line_coverage', value: '70.0' },
              { metric: 'branch_coverage', value: '40.0' },
              { metric: 'uncovered_lines', value: '4' },
              { metric: 'uncovered_conditions', value: '2' }
            ]
          }]
        })
        .mockResolvedValueOnce({
          components: [{
            key: 'proj:src/shared.ts',
            path: 'src/shared.ts',
            name: 'shared.ts',
            measures: [
              { metric: 'duplicated_lines_density', value: '12.5' },
              { metric: 'duplicated_lines', value: '10' },
              { metric: 'duplicated_blocks', value: '2' }
            ]
          }]
        })
        .mockResolvedValueOnce({
          hotspots: [{
            key: 'hot-1',
            component: 'proj:src/auth.ts',
            line: 10,
            message: 'Review this auth flow.',
            status: 'TO_REVIEW',
            vulnerabilityProbability: 'HIGH'
          }]
        })
        .mockResolvedValueOnce({
          component: {
            measures: [
              { metric: 'coverage', value: '82.1' },
              { metric: 'line_coverage', value: '85.0' },
              { metric: 'branch_coverage', value: '70.0' },
              { metric: 'duplicated_lines_density', value: '4.5' },
              { metric: 'duplicated_lines', value: '24' },
              { metric: 'duplicated_blocks', value: '5' },
              { metric: 'security_hotspots', value: '3' },
              { metric: 'security_hotspots_reviewed', value: '66.7' },
              { metric: 'security_review_rating', value: 'A' }
            ]
          }
        })
        .mockResolvedValueOnce({
          rules: [{ key: 'typescript:S1', name: 'Rule 1' }]
        })
        .mockResolvedValueOnce({
          component: { key: 'proj', name: 'Project', qualifier: 'TRK' }
        })
    });
    (backend as any).httpClient = client;

    await expect(backend.getIssues()).resolves.toEqual([{
      key: '1',
      rule: 'typescript:S1',
      message: 'Issue',
      severity: 'MAJOR',
      type: 'CODE_SMELL',
      status: undefined,
      component: 'proj:src/file.ts',
      line: undefined,
      effort: undefined,
      tags: ['tag']
    }]);
    await expect(backend.getCoverageTargets()).resolves.toEqual([{
      key: 'proj:src/file.ts',
      component: 'src/file.ts',
      path: 'src/file.ts',
      coverage: 55.5,
      lineCoverage: 70,
      branchCoverage: 40,
      linesToCover: undefined,
      uncoveredLines: 4,
      conditionsToCover: undefined,
      uncoveredConditions: 2
    }]);
    await expect(backend.getDuplicationTargets()).resolves.toEqual([{
      key: 'proj:src/shared.ts',
      component: 'src/shared.ts',
      path: 'src/shared.ts',
      duplicatedLinesDensity: 12.5,
      duplicatedLines: 10,
      duplicatedBlocks: 2
    }]);
    await expect(backend.getSecurityHotspots()).resolves.toEqual([{
      key: 'hot-1',
      component: 'proj:src/auth.ts',
      line: 10,
      message: 'Review this auth flow.',
      status: 'TO_REVIEW',
      vulnerabilityProbability: 'HIGH'
    }]);
    await expect(backend.getKpiSummary()).resolves.toEqual({
      coverage: 82.1,
      lineCoverage: 85,
      branchCoverage: 70,
      duplicationDensity: 4.5,
      duplicatedLines: 24,
      duplicatedBlocks: 5,
      securityHotspots: 3,
      securityHotspotsReviewed: 66.7,
      securityReviewRating: 'A'
    });
    await expect(backend.getRules(['typescript:S1'])).resolves.toEqual([{ key: 'typescript:S1', name: 'Rule 1', htmlDesc: undefined, severity: undefined, type: undefined }]);
    await expect(backend.getRules([])).resolves.toEqual([]);
    await expect(backend.getProjectInfo()).resolves.toEqual({ key: 'proj', name: 'Project', qualifier: 'TRK' });
    await expect(backend.getCapabilities()).resolves.toEqual({
      supportsBearerAuth: true,
      supportsBasicTokenAuth: false,
      isCloud: true,
      serverVersion: 'cloud'
    });

    expect(client.getJson).toHaveBeenNthCalledWith(1, '/api/issues/search', {
      componentKeys: 'proj',
      organization: 'org',
      branch: 'main',
      pullRequest: '42',
      statuses: 'OPEN,CONFIRMED,REOPENED',
      ps: 500
    });
  });

  it('filters out fully covered files and tolerates invalid KPI values', async () => {
    const backend = new SonarCloudBackend(cloudConnection, 'token');
    (backend as any).httpClient = mockClient({
      getJson: vi.fn()
        .mockResolvedValueOnce({
          components: [
            {
              key: 'proj:src/covered.ts',
              name: 'covered.ts',
              measures: [
                { metric: 'coverage', value: '100' },
                { metric: 'uncovered_lines', value: '0' },
                { metric: 'uncovered_conditions', value: '0' }
              ]
            },
            {
              key: 'proj:src/partial.ts',
              name: 'partial.ts',
              measures: [
                { metric: 'coverage', value: 'oops' },
                { metric: 'uncovered_lines', value: '3' }
              ]
            },
            {
              key: 'proj:src/branches.ts',
              name: 'branches.ts',
              measures: [
                { metric: 'uncovered_lines', value: '0' },
                { metric: 'uncovered_conditions', value: '2' }
              ]
            },
            {
              key: 'proj:src/fallback.ts',
              name: 'fallback.ts'
            }
          ]
        })
        .mockResolvedValueOnce({
          component: {
            measures: [
              { metric: 'coverage', value: 'NaN-ish' },
              { metric: 'duplicated_lines', value: '7' },
              { metric: 'security_hotspots', value: '2' }
            ]
          }
        })
    });

    await expect(backend.getCoverageTargets()).resolves.toEqual([{
      key: 'proj:src/partial.ts',
      component: 'partial.ts',
      path: 'partial.ts',
      coverage: undefined,
      lineCoverage: undefined,
      branchCoverage: undefined,
      linesToCover: undefined,
      uncoveredLines: 3,
      conditionsToCover: undefined,
      uncoveredConditions: undefined
    }, {
      key: 'proj:src/branches.ts',
      component: 'branches.ts',
      path: 'branches.ts',
      coverage: undefined,
      lineCoverage: undefined,
      branchCoverage: undefined,
      linesToCover: undefined,
      uncoveredLines: 0,
      conditionsToCover: undefined,
      uncoveredConditions: 2
    }]);
    await expect(backend.getKpiSummary()).resolves.toEqual({
      coverage: undefined,
      lineCoverage: undefined,
      branchCoverage: undefined,
      duplicationDensity: undefined,
      duplicatedLines: 7,
      duplicatedBlocks: undefined,
      securityHotspots: 2,
      securityHotspotsReviewed: undefined,
      securityReviewRating: undefined
    });
  });

  it('filters out clean duplication targets', async () => {
    const backend = new SonarCloudBackend(cloudConnection, 'token');
    (backend as any).httpClient = mockClient({
      getJson: vi.fn().mockResolvedValue({
        components: [
          {
            key: 'proj:src/clean.ts',
            name: 'clean.ts',
            measures: [
              { metric: 'duplicated_lines_density', value: '0' },
              { metric: 'duplicated_lines', value: '0' },
              { metric: 'duplicated_blocks', value: '0' }
            ]
          },
          {
            key: 'proj:src/shared.ts',
            name: 'shared.ts',
            measures: [
              { metric: 'duplicated_lines_density', value: 'oops' },
              { metric: 'duplicated_blocks', value: '2' }
            ]
          },
          {
            key: 'proj:src/lines.ts',
            name: 'lines.ts',
            measures: [
              { metric: 'duplicated_lines', value: '6' }
            ]
          },
          {
            key: 'proj:src/fallback.ts',
            name: 'fallback.ts'
          }
        ]
      })
    });

    await expect(backend.getDuplicationTargets()).resolves.toEqual([{
      key: 'proj:src/shared.ts',
      component: 'shared.ts',
      path: 'shared.ts',
      duplicatedLinesDensity: undefined,
      duplicatedLines: undefined,
      duplicatedBlocks: 2
    }, {
      key: 'proj:src/lines.ts',
      component: 'lines.ts',
      path: 'lines.ts',
      duplicatedLinesDensity: undefined,
      duplicatedLines: 6,
      duplicatedBlocks: undefined
    }]);
  });
});

describe('SonarQubeServerBackend', () => {
  it('tests the connection successfully', async () => {
    const backend = new SonarQubeServerBackend(serverConnection, 'token');
    (backend as any).httpClient = mockClient({
      getJson: vi.fn()
        .mockResolvedValueOnce({ valid: true })
        .mockResolvedValueOnce({
          components: [{ key: 'proj', name: 'Project', qualifier: 'TRK' }]
        })
    });

    await expect(backend.testConnection()).resolves.toEqual({
      ok: true,
      kind: 'success',
      message: 'Connection succeeded and the configured project is accessible.'
    });
  });

  it('maps testConnection project-not-found and auth errors', async () => {
    const backend = new SonarQubeServerBackend(serverConnection, 'token');
    (backend as any).httpClient = mockClient({
      getJson: vi.fn().mockRejectedValueOnce(new HttpError('Missing', 404, 'no-project'))
    });

    await expect(backend.testConnection()).resolves.toEqual({
      ok: false,
      kind: 'projectNotFound',
      message: 'The Sonar server is reachable, but the configured project key was not found.',
      details: 'no-project'
    });

    (backend as any).httpClient = mockClient({
      getJson: vi.fn().mockRejectedValue(new HttpError('Forbidden', 403, 'denied'))
    });

    await expect(backend.testConnection()).resolves.toMatchObject({
      ok: false,
      kind: 'auth'
    });
  });

  it('fetches server issues, rules, project info, and capabilities', async () => {
    const backend = new SonarQubeServerBackend(serverConnection, 'token');
    const client = mockClient({
      getJson: vi.fn()
        .mockResolvedValueOnce({
          issues: [{
            key: '1',
            rule: 'typescript:S1',
            message: 'Issue',
            severity: 'BLOCKER',
            type: 'BUG',
            component: 'proj:src/file.ts'
          }]
        })
        .mockResolvedValueOnce({
          components: [{
            key: 'proj:src/file.ts',
            path: 'src/file.ts',
            name: 'file.ts',
            measures: [
              { metric: 'coverage', value: '50' },
              { metric: 'line_coverage', value: '60' },
              { metric: 'branch_coverage', value: '40' },
              { metric: 'uncovered_lines', value: '8' },
              { metric: 'uncovered_conditions', value: '3' }
            ]
          }]
        })
        .mockResolvedValueOnce({
          components: [{
            key: 'proj:src/shared.ts',
            path: 'src/shared.ts',
            name: 'shared.ts',
            measures: [
              { metric: 'duplicated_lines_density', value: '15' },
              { metric: 'duplicated_lines', value: '14' },
              { metric: 'duplicated_blocks', value: '3' }
            ]
          }]
        })
        .mockResolvedValueOnce({
          hotspots: [{
            key: 'hot-1',
            component: 'proj:src/auth.ts',
            line: 10,
            message: 'Review this auth flow.',
            status: 'TO_REVIEW',
            vulnerabilityProbability: 'MEDIUM'
          }]
        })
        .mockResolvedValueOnce({
          component: {
            measures: [
              { metric: 'coverage', value: '75' },
              { metric: 'line_coverage', value: '80' },
              { metric: 'branch_coverage', value: '55' },
              { metric: 'duplicated_lines_density', value: '6' },
              { metric: 'duplicated_lines', value: '12' },
              { metric: 'duplicated_blocks', value: '4' },
              { metric: 'security_hotspots', value: '4' },
              { metric: 'security_hotspots_reviewed', value: '25' },
              { metric: 'security_review_rating', value: 'B' }
            ]
          }
        })
        .mockResolvedValueOnce({
          rules: [{ key: 'typescript:S1', name: 'Rule 1', severity: 'BLOCKER', type: 'BUG' }]
        })
        .mockResolvedValueOnce({
          components: [
            { key: 'other', name: 'Other' },
            { key: 'proj', name: 'Project', qualifier: 'TRK' }
          ]
        }),
      getText: vi.fn().mockResolvedValue('10.7.0 ')
    });
    (backend as any).httpClient = client;

    await expect(backend.getIssues()).resolves.toHaveLength(1);
    expect(client.getJson).toHaveBeenNthCalledWith(1, '/api/issues/search', {
      componentKeys: 'proj',
      branch: 'main',
      pullRequest: '42',
      statuses: 'OPEN,CONFIRMED,REOPENED',
      ps: 500
    });
    await expect(backend.getCoverageTargets()).resolves.toEqual([{
      key: 'proj:src/file.ts',
      component: 'src/file.ts',
      path: 'src/file.ts',
      coverage: 50,
      lineCoverage: 60,
      branchCoverage: 40,
      linesToCover: undefined,
      uncoveredLines: 8,
      conditionsToCover: undefined,
      uncoveredConditions: 3
    }]);
    await expect(backend.getDuplicationTargets()).resolves.toEqual([{
      key: 'proj:src/shared.ts',
      component: 'src/shared.ts',
      path: 'src/shared.ts',
      duplicatedLinesDensity: 15,
      duplicatedLines: 14,
      duplicatedBlocks: 3
    }]);
    await expect(backend.getSecurityHotspots()).resolves.toEqual([{
      key: 'hot-1',
      component: 'proj:src/auth.ts',
      line: 10,
      message: 'Review this auth flow.',
      status: 'TO_REVIEW',
      vulnerabilityProbability: 'MEDIUM'
    }]);
    await expect(backend.getKpiSummary()).resolves.toEqual({
      coverage: 75,
      lineCoverage: 80,
      branchCoverage: 55,
      duplicationDensity: 6,
      duplicatedLines: 12,
      duplicatedBlocks: 4,
      securityHotspots: 4,
      securityHotspotsReviewed: 25,
      securityReviewRating: 'B'
    });
    await expect(backend.getRules(['typescript:S1'])).resolves.toEqual([{
      key: 'typescript:S1',
      name: 'Rule 1',
      htmlDesc: undefined,
      severity: 'BLOCKER',
      type: 'BUG'
    }]);
    await expect(backend.getRules([])).resolves.toEqual([]);
    await expect(backend.getProjectInfo()).resolves.toEqual({ key: 'proj', name: 'Project', qualifier: 'TRK' });
    await expect(backend.getCapabilities()).resolves.toEqual({
      supportsBearerAuth: true,
      supportsBasicTokenAuth: true,
      isCloud: false,
      serverVersion: '10.7.0'
    });
  });

  it('throws when the project cannot be found and tolerates version lookup failure', async () => {
    const backend = new SonarQubeServerBackend(serverConnection, 'token');
    (backend as any).httpClient = mockClient({
      getJson: vi.fn().mockResolvedValue({ components: [{ key: 'other', name: 'Other' }] }),
      getText: vi.fn().mockRejectedValue(new Error('down'))
    });

    await expect(backend.getProjectInfo()).rejects.toMatchObject({ statusCode: 404 });
    await expect(backend.getCapabilities()).resolves.toEqual({
      supportsBearerAuth: true,
      supportsBasicTokenAuth: true,
      isCloud: false,
      serverVersion: undefined
    });
  });

  it('filters out fully covered server files and tolerates invalid KPI values', async () => {
    const backend = new SonarQubeServerBackend(serverConnection, 'token');
    (backend as any).httpClient = mockClient({
      getJson: vi.fn()
        .mockResolvedValueOnce({
          components: [
            {
              key: 'proj:src/covered.ts',
              name: 'covered.ts',
              measures: [
                { metric: 'coverage', value: '100' },
                { metric: 'uncovered_lines', value: '0' },
                { metric: 'uncovered_conditions', value: '0' }
              ]
            },
            {
              key: 'proj:src/partial.ts',
              name: 'partial.ts',
              measures: [
                { metric: 'uncovered_lines', value: '1' },
                { metric: 'branch_coverage', value: 'bad-number' },
                { metric: 'uncovered_conditions', value: '4' }
              ]
            },
            {
              key: 'proj:src/branches-only.ts',
              name: 'branches-only.ts',
              measures: [
                { metric: 'uncovered_lines', value: '0' },
                { metric: 'uncovered_conditions', value: '5' }
              ]
            },
            {
              key: 'proj:src/fallback.ts',
              name: 'fallback.ts'
            }
          ]
        })
        .mockResolvedValueOnce({
          component: {
            measures: [
              { metric: 'branch_coverage', value: 'still-bad' },
              { metric: 'duplicated_blocks', value: '9' },
              { metric: 'security_review_rating', value: 'C' }
            ]
          }
        })
    });

    await expect(backend.getCoverageTargets()).resolves.toEqual([{
      key: 'proj:src/partial.ts',
      component: 'partial.ts',
      path: 'partial.ts',
      coverage: undefined,
      lineCoverage: undefined,
      branchCoverage: undefined,
      linesToCover: undefined,
      uncoveredLines: 1,
      conditionsToCover: undefined,
      uncoveredConditions: 4
    }, {
      key: 'proj:src/branches-only.ts',
      component: 'branches-only.ts',
      path: 'branches-only.ts',
      coverage: undefined,
      lineCoverage: undefined,
      branchCoverage: undefined,
      linesToCover: undefined,
      uncoveredLines: 0,
      conditionsToCover: undefined,
      uncoveredConditions: 5
    }]);
    await expect(backend.getKpiSummary()).resolves.toEqual({
      coverage: undefined,
      lineCoverage: undefined,
      branchCoverage: undefined,
      duplicationDensity: undefined,
      duplicatedLines: undefined,
      duplicatedBlocks: 9,
      securityHotspots: undefined,
      securityHotspotsReviewed: undefined,
      securityReviewRating: 'C'
    });
  });

  it('filters out clean server duplication targets', async () => {
    const backend = new SonarQubeServerBackend(serverConnection, 'token');
    (backend as any).httpClient = mockClient({
      getJson: vi.fn().mockResolvedValue({
        components: [
          {
            key: 'proj:src/clean.ts',
            name: 'clean.ts',
            measures: [
              { metric: 'duplicated_lines_density', value: '0' },
              { metric: 'duplicated_lines', value: '0' }
            ]
          },
          {
            key: 'proj:src/shared.ts',
            name: 'shared.ts',
            measures: [
              { metric: 'duplicated_lines_density', value: '3.5' },
              { metric: 'duplicated_blocks', value: 'bad-number' }
            ]
          },
          {
            key: 'proj:src/lines.ts',
            name: 'lines.ts',
            measures: [
              { metric: 'duplicated_lines', value: '5' }
            ]
          },
          {
            key: 'proj:src/fallback.ts',
            name: 'fallback.ts'
          }
        ]
      })
    });

    await expect(backend.getDuplicationTargets()).resolves.toEqual([{
      key: 'proj:src/shared.ts',
      component: 'shared.ts',
      path: 'shared.ts',
      duplicatedLinesDensity: 3.5,
      duplicatedLines: undefined,
      duplicatedBlocks: undefined
    }, {
      key: 'proj:src/lines.ts',
      component: 'lines.ts',
      path: 'lines.ts',
      duplicatedLinesDensity: undefined,
      duplicatedLines: 5,
      duplicatedBlocks: undefined
    }]);
  });
});
