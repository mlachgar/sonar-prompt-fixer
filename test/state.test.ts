import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ConnectionState } from '../src/state/ConnectionState';
import { FilterState } from '../src/state/FilterState';
import { SelectionState } from '../src/state/SelectionState';
import { SonarIssue } from '../src/sonar/types';
import { ConfigurationTarget } from './vscodeMock';
import { createSecretStorage, getUpdateCalls, resetVscodeMock, setConfiguration, setWorkspaceFolders } from './vscodeMock';

const issues: SonarIssue[] = [
  {
    key: 'A',
    rule: 'typescript:S100',
    message: 'Rename this.',
    severity: 'MAJOR',
    type: 'CODE_SMELL',
    component: 'proj:src/a.ts',
    status: 'OPEN'
  },
  {
    key: 'B',
    rule: 'typescript:S200',
    message: 'Fix this.',
    severity: 'CRITICAL',
    type: 'BUG',
    component: 'proj:src/b.ts',
    status: 'RESOLVED'
  }
];

describe('FilterState', () => {
  it('stores cloned filters and filters issues with OPEN fallback status', () => {
    const state = new FilterState();
    const onDidChange = vi.fn();
    state.onDidChange(onDidChange);

    const filters = {
      types: ['BUG'] as const,
      severities: ['CRITICAL'] as const,
      statuses: ['OPEN'],
      ruleQuery: 'S200',
      componentQuery: 'src/b'
    };

    state.setFilters(filters);
    filters.statuses.push('RESOLVED');

    expect(onDidChange).toHaveBeenCalledTimes(1);
    expect(state.getFilters().statuses).toEqual(['OPEN']);

    state.setFilters({
      types: ['BUG'],
      severities: ['CRITICAL'],
      statuses: ['OPEN'],
      ruleQuery: 'S200',
      componentQuery: 'src/b'
    });
    const unresolvedBug = { ...issues[1], status: undefined };
    expect(state.apply([unresolvedBug])).toEqual([unresolvedBug]);
  });

  it('handles each filter condition independently', () => {
    const state = new FilterState();

    state.setFilters({
      types: ['VULNERABILITY'],
      severities: [],
      statuses: [],
      ruleQuery: undefined,
      componentQuery: undefined
    });
    expect(state.apply(issues)).toEqual([]);

    state.setFilters({
      types: [],
      severities: ['INFO'],
      statuses: [],
      ruleQuery: undefined,
      componentQuery: undefined
    });
    expect(state.apply(issues)).toEqual([]);

    state.setFilters({
      types: [],
      severities: [],
      statuses: ['CONFIRMED'],
      ruleQuery: undefined,
      componentQuery: undefined
    });
    expect(state.apply(issues)).toEqual([]);

    state.setFilters({
      types: [],
      severities: [],
      statuses: [],
      ruleQuery: 'missing',
      componentQuery: undefined
    });
    expect(state.apply(issues)).toEqual([]);

    state.setFilters({
      types: [],
      severities: [],
      statuses: [],
      ruleQuery: undefined,
      componentQuery: 'missing'
    });
    expect(state.apply(issues)).toEqual([]);

    state.clear();
    expect(state.apply(issues)).toEqual(issues);
  });

  it('clears filters back to the empty state', () => {
    const state = new FilterState();
    state.setFilters({
      types: ['BUG'],
      severities: ['CRITICAL'],
      statuses: ['OPEN'],
      ruleQuery: 'abc',
      componentQuery: 'src'
    });

    state.clear();

    expect(state.getFilters()).toEqual({
      types: [],
      severities: [],
      statuses: [],
      ruleQuery: undefined,
      componentQuery: undefined
    });
  });
});

describe('SelectionState', () => {
  it('tracks selected issues across toggle, bulk select, and clear', () => {
    const state = new SelectionState();
    const onDidChange = vi.fn();
    state.onDidChange(onDidChange);

    state.setKnownIssues(issues);
    state.toggle(issues[0]);
    state.selectMany([issues[0], issues[1]]);

    expect(state.isSelected('A')).toBe(true);
    expect(state.getSelectedCount()).toBe(2);
    expect(state.getSelectedIssues()).toEqual([issues[0], issues[1]]);

    state.toggle(issues[0]);
    expect(state.isSelected('A')).toBe(false);

    state.clear();
    expect(state.getSelectedCount()).toBe(0);
    expect(onDidChange).toHaveBeenCalledTimes(4);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  resetVscodeMock();
  setWorkspaceFolders([{ uri: { fsPath: process.cwd() } }]);
});

describe('ConnectionState', () => {
  it('reads the active saved profile and loads its stored token', async () => {
    setWorkspaceFolders(undefined);
    setConfiguration({
      'connections.activeProfileId': 'server-profile',
      'connections.profiles': [
        {
          id: 'server-profile',
          name: 'Server',
          connection: {
            type: 'server',
            baseUrl: ' https://sonar.example.com ',
            projectKey: ' app_key ',
            organization: ' ',
            branch: ' main ',
            pullRequest: ' ',
            verifyTls: false,
            authMode: 'basicToken'
          }
        }
      ]
    });

    const secrets = createSecretStorage({ 'sonarPromptFixer.token.server-profile': 'secret-token' });
    const state = new ConnectionState({ secrets, extensionPath: '/extension' } as never);

    expect(state.getConnection()).toEqual({
      type: 'server',
      baseUrl: 'https://sonar.example.com',
      projectKey: 'app_key',
      organization: undefined,
      branch: 'main',
      pullRequest: undefined,
      verifyTls: false,
      authMode: 'basicToken'
    });
    await expect(state.getToken()).resolves.toBe('secret-token');
  });

  it('prefills the default profile from sonar-project.properties when no profile is saved', () => {
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'spf-fallback-'));
    setWorkspaceFolders([{ uri: { fsPath: workspacePath } }]);
    fs.writeFileSync(
      path.join(workspacePath, 'sonar-project.properties'),
      'sonar.projectKey=from-file\nsonar.organization=from-org\n'
    );

    const state = new ConnectionState({ secrets: createSecretStorage(), extensionPath: '/extension' } as never);

    expect(state.getConnection()).toMatchObject({
      projectKey: 'from-file',
      organization: 'from-org'
    });

    fs.rmSync(workspacePath, { recursive: true, force: true });
  });

  it('prefills the default profile from the extension path when no workspace folder is open', () => {
    const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'spf-extension-'));
    setWorkspaceFolders(undefined);
    fs.writeFileSync(
      path.join(extensionPath, 'sonar-project.properties'),
      'sonar.projectKey=from-extension\nsonar.organization=from-extension-org\n'
    );

    const state = new ConnectionState({ secrets: createSecretStorage(), extensionPath } as never);

    expect(state.getConnection()).toMatchObject({
      projectKey: 'from-extension',
      organization: 'from-extension-org'
    });

    fs.rmSync(extensionPath, { recursive: true, force: true });
  });

  it('uses saved profiles instead of sonar-project.properties defaults', () => {
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'spf-explicit-'));
    setConfiguration({
      'connections.activeProfileId': 'cloud-profile',
      'connections.profiles': [
        {
          id: 'cloud-profile',
          name: 'Cloud',
          connection: {
            type: 'cloud',
            baseUrl: 'https://sonarcloud.io',
            projectKey: 'configured-key',
            organization: 'configured-org'
          }
        }
      ]
    });
    setWorkspaceFolders([{ uri: { fsPath: workspacePath } }]);
    fs.writeFileSync(
      path.join(workspacePath, 'sonar-project.properties'),
      'sonar.projectKey=from-file\nsonar.organization=from-org\n'
    );

    const state = new ConnectionState({ secrets: createSecretStorage(), extensionPath: '/extension' } as never);

    expect(state.getConnection()).toMatchObject({
      projectKey: 'configured-key',
      organization: 'configured-org'
    });

    fs.rmSync(workspacePath, { recursive: true, force: true });
  });

  it('saves profiles, updates the active profile, and notifies listeners', async () => {
    const secrets = createSecretStorage();
    const state = new ConnectionState({ secrets, extensionPath: '/extension' } as never);
    const onDidChange = vi.fn();
    state.onDidChange(onDidChange);

    await state.updateSetting('prompt.defaultStyle', 'guided');
    await state.saveProfile({
      name: 'Cloud profile',
      connection: {
        type: 'cloud',
        baseUrl: 'https://sonarcloud.io',
        projectKey: 'proj',
        organization: 'org',
        branch: 'feature',
        pullRequest: '123',
        verifyTls: true,
        authMode: 'bearer'
      }
    }, 'profile-token');
    state.notifyChanged();

    const updates = getUpdateCalls();
    expect(updates[0]).toEqual({
      key: 'prompt.defaultStyle',
      value: 'guided',
      target: ConfigurationTarget.Global
    });
    expect(updates.slice(1).map((call) => call.key)).toEqual([
      'connections.profiles',
      'connections.activeProfileId'
    ]);
    expect(state.getProfiles()).toHaveLength(1);
    expect(state.getActiveProfile().name).toBe('Cloud profile');
    await expect(state.getToken()).resolves.toBe('profile-token');
    expect(onDidChange).toHaveBeenCalledTimes(3);
  });

  it('falls back to default values when optional profile connection fields are omitted', async () => {
    const state = new ConnectionState({ secrets: createSecretStorage(), extensionPath: '/extension' } as never);

    const savedProfile = await state.saveProfile({
      name: 'Server profile',
      connection: {
        type: 'server',
        baseUrl: 'https://sonar.example.com',
        projectKey: 'proj'
      }
    }, '');

    expect(savedProfile.connection).toEqual({
      type: 'server',
      baseUrl: 'https://sonar.example.com',
      projectKey: 'proj',
      organization: undefined,
      branch: undefined,
      pullRequest: undefined,
      verifyTls: true,
      authMode: 'bearer'
    });
  });

  it('switches and deletes saved profiles cleanly', async () => {
    setConfiguration({
      'connections.activeProfileId': 'first',
      'connections.profiles': [
        {
          id: 'first',
          name: 'First',
          connection: {
            type: 'cloud',
            baseUrl: 'https://sonarcloud.io',
            projectKey: 'one'
          }
        },
        {
          id: 'second',
          name: 'Second',
          connection: {
            type: 'server',
            baseUrl: 'https://sonar.example.com',
            projectKey: 'two'
          }
        }
      ]
    });
    const secrets = createSecretStorage({
      'sonarPromptFixer.token.first': 'one-token',
      'sonarPromptFixer.token.second': 'two-token'
    });
    const state = new ConnectionState({ secrets, extensionPath: '/extension' } as never);

    await state.selectProfile('second');
    expect(state.getActiveProfile().id).toBe('second');
    expect(state.getConnection().projectKey).toBe('two');
    await expect(state.getToken()).resolves.toBe('two-token');

    await state.deleteProfile('second');
    expect(state.getActiveProfile().id).toBe('first');
    expect(state.getConnection().projectKey).toBe('one');
    await expect(state.getToken()).resolves.toBe('one-token');
  });

  it('falls back to SONAR_TOKEN from .env when secret storage is empty', async () => {
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'spf-env-token-'));
    setWorkspaceFolders([{ uri: { fsPath: workspacePath } }]);
    fs.writeFileSync(path.join(workspacePath, '.env'), 'SONAR_TOKEN="from-env-token"\n');

    const state = new ConnectionState({ secrets: createSecretStorage(), extensionPath: '/extension' } as never);

    await expect(state.getToken()).resolves.toBe('from-env-token');

    fs.rmSync(workspacePath, { recursive: true, force: true });
  });

  it('falls back to SONAR_TOKEN from the extension path .env when no workspace is open', async () => {
    const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'spf-extension-env-'));
    setWorkspaceFolders(undefined);
    fs.writeFileSync(path.join(extensionPath, '.env'), "SONAR_TOKEN='from-extension-env'\n");

    const state = new ConnectionState({ secrets: createSecretStorage(), extensionPath } as never);

    await expect(state.getToken()).resolves.toBe('from-extension-env');

    fs.rmSync(extensionPath, { recursive: true, force: true });
  });
});
