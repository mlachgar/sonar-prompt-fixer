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
});
