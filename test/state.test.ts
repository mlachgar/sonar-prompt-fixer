import { describe, expect, it, vi } from 'vitest';
import { ConnectionState } from '../src/state/ConnectionState';
import { FilterState } from '../src/state/FilterState';
import { SelectionState } from '../src/state/SelectionState';
import { SonarIssue } from '../src/sonar/types';
import { ConfigurationTarget } from './vscodeMock';
import { createSecretStorage, getUpdateCalls, setConfiguration } from './vscodeMock';

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

describe('ConnectionState', () => {
  it('reads trimmed connection values and loads the stored token', async () => {
    setConfiguration({
      'connection.type': 'server',
      'connection.baseUrl': ' https://sonar.example.com ',
      'connection.projectKey': ' app_key ',
      'connection.organization': ' ',
      'connection.branch': ' main ',
      'connection.pullRequest': ' ',
      'connection.verifyTls': false,
      'connection.authMode': 'basicToken'
    });

    const secrets = createSecretStorage({ 'sonarPromptFixer.token': 'secret-token' });
    const state = new ConnectionState({ secrets } as never);

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

  it('updates settings, updates full connection, and notifies listeners', async () => {
    const secrets = createSecretStorage();
    const state = new ConnectionState({ secrets } as never);
    const onDidChange = vi.fn();
    state.onDidChange(onDidChange);

    await state.updateSetting('prompt.defaultStyle', 'guided');
    await state.updateConnection({
      type: 'cloud',
      baseUrl: 'https://sonarcloud.io',
      projectKey: 'proj',
      organization: 'org',
      branch: 'feature',
      pullRequest: '123',
      verifyTls: true,
      authMode: 'bearer'
    });
    state.notifyChanged();

    const updates = getUpdateCalls();
    expect(updates[0]).toEqual({
      key: 'prompt.defaultStyle',
      value: 'guided',
      target: ConfigurationTarget.Global
    });
    expect(updates.slice(1).map((call) => call.key)).toEqual([
      'connection.type',
      'connection.baseUrl',
      'connection.projectKey',
      'connection.organization',
      'connection.branch',
      'connection.pullRequest',
      'connection.verifyTls',
      'connection.authMode'
    ]);
    expect(onDidChange).toHaveBeenCalledTimes(3);
  });

  it('falls back to default values when optional connection fields are omitted', async () => {
    const state = new ConnectionState({ secrets: createSecretStorage() } as never);

    await state.updateConnection({
      type: 'server',
      baseUrl: 'https://sonar.example.com',
      projectKey: 'proj'
    });

    expect(getUpdateCalls().slice(-5)).toEqual([
      { key: 'connection.organization', value: '', target: ConfigurationTarget.Global },
      { key: 'connection.branch', value: '', target: ConfigurationTarget.Global },
      { key: 'connection.pullRequest', value: '', target: ConfigurationTarget.Global },
      { key: 'connection.verifyTls', value: true, target: ConfigurationTarget.Global },
      { key: 'connection.authMode', value: 'bearer', target: ConfigurationTarget.Global }
    ]);
  });
});
