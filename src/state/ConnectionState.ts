import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { SonarConnection, SonarConnectionProfile } from '../sonar/types';
import { deleteToken, loadStoredToken, loadToken, storeToken } from '../util/secrets';
import { loadSonarProjectProperties } from '../util/sonarProjectProperties';

const PROFILES_SECTION = 'connections.profiles';
const ACTIVE_PROFILE_SECTION = 'connections.activeProfileId';
const EMPTY_PROFILE_ID = '__default__';
const EMPTY_PROFILE_NAME = 'New Connection';

export class ConnectionState {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;
  private profiles: SonarConnectionProfile[];
  private activeProfileId: string;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.profiles = this.readStoredProfiles();
    this.activeProfileId = this.readActiveProfileId(this.profiles);
  }

  public getConnection(): SonarConnection {
    return this.getActiveProfile().connection;
  }

  public getProfiles(): SonarConnectionProfile[] {
    if (this.profiles.length > 0) {
      return [...this.profiles];
    }

    return [this.getDefaultProfile()];
  }

  public getActiveProfileId(): string {
    if (this.profiles.some((profile) => profile.id === this.activeProfileId)) {
      return this.activeProfileId;
    }

    return this.getProfiles()[0].id;
  }

  public getActiveProfile(): SonarConnectionProfile {
    const activeProfileId = this.getActiveProfileId();
    return this.getProfiles().find((profile) => profile.id === activeProfileId) ?? this.getProfiles()[0];
  }

  public async getToken(profileId?: string): Promise<string | undefined> {
    const activeProfileId = profileId ?? this.getActiveProfileId();
    if (activeProfileId !== EMPTY_PROFILE_ID) {
      const storedToken = await loadStoredToken(this.context.secrets, activeProfileId);
      if (storedToken) {
        return storedToken;
      }
    }

    return loadToken(this.context.secrets, this.context.extensionPath, activeProfileId === EMPTY_PROFILE_ID ? undefined : activeProfileId);
  }

  public async updateSetting<T>(section: string, value: T): Promise<void> {
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    await config.update(section, value, vscode.ConfigurationTarget.Global);
    this.onDidChangeEmitter.fire();
  }

  public async saveProfile(
    profile: Partial<SonarConnectionProfile> & { connection: SonarConnection },
    token: string
  ): Promise<SonarConnectionProfile> {
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    const profiles = this.profiles;
    const nextProfile: SonarConnectionProfile = {
      id: profile.id?.trim() || randomUUID(),
      name: profile.name?.trim() || inferProfileName(profile.connection),
      connection: normalizeConnection(profile.connection)
    };
    const existingIndex = profiles.findIndex((item) => item.id === nextProfile.id);
    const nextProfiles = [...profiles];

    if (existingIndex >= 0) {
      nextProfiles[existingIndex] = nextProfile;
    } else {
      nextProfiles.push(nextProfile);
    }

    this.profiles = nextProfiles;
    this.activeProfileId = nextProfile.id;
    await config.update(PROFILES_SECTION, nextProfiles, vscode.ConfigurationTarget.Global);
    await config.update(ACTIVE_PROFILE_SECTION, nextProfile.id, vscode.ConfigurationTarget.Global);

    const trimmedToken = token.trim();
    if (trimmedToken) {
      await storeToken(this.context.secrets, trimmedToken, nextProfile.id);
    } else {
      await deleteToken(this.context.secrets, nextProfile.id);
    }

    this.onDidChangeEmitter.fire();
    return nextProfile;
  }

  public async selectProfile(profileId: string): Promise<void> {
    if (!this.profiles.some((profile) => profile.id === profileId)) {
      return;
    }

    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    this.activeProfileId = profileId;
    await config.update(ACTIVE_PROFILE_SECTION, profileId, vscode.ConfigurationTarget.Global);
    this.onDidChangeEmitter.fire();
  }

  public async deleteProfile(profileId: string): Promise<void> {
    const nextProfiles = this.profiles.filter((profile) => profile.id !== profileId);
    if (nextProfiles.length === this.profiles.length) {
      return;
    }

    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    this.profiles = nextProfiles;
    this.activeProfileId = nextProfiles[0]?.id ?? '';
    await config.update(PROFILES_SECTION, nextProfiles, vscode.ConfigurationTarget.Global);
    await deleteToken(this.context.secrets, profileId);
    await config.update(
      ACTIVE_PROFILE_SECTION,
      this.activeProfileId,
      vscode.ConfigurationTarget.Global
    );

    this.onDidChangeEmitter.fire();
  }

  public notifyChanged(): void {
    this.onDidChangeEmitter.fire();
  }

  private readStoredProfiles(): SonarConnectionProfile[] {
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    const rawProfiles = config.get<unknown[]>(PROFILES_SECTION, []);
    if (!Array.isArray(rawProfiles)) {
      return [];
    }

    return rawProfiles
      .map(sanitizeStoredProfile)
      .filter((profile): profile is SonarConnectionProfile => Boolean(profile));
  }

  private readActiveProfileId(profiles: SonarConnectionProfile[]): string {
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    const configuredId = config.get<string>(ACTIVE_PROFILE_SECTION, '').trim();
    if (configuredId && profiles.some((profile) => profile.id === configuredId)) {
      return configuredId;
    }

    return profiles[0]?.id ?? '';
  }

  private getDefaultProfile(): SonarConnectionProfile {
    const fallbackProperties = loadSonarProjectProperties(this.context.extensionPath);
    return {
      id: EMPTY_PROFILE_ID,
      name: EMPTY_PROFILE_NAME,
      connection: {
        type: 'cloud',
        baseUrl: 'https://sonarcloud.io',
        projectKey: fallbackProperties.projectKey || '',
        organization: fallbackProperties.organization || undefined,
        branch: undefined,
        pullRequest: undefined,
        verifyTls: true,
        authMode: 'bearer'
      }
    };
  }
}

function sanitizeStoredProfile(rawProfile: unknown): SonarConnectionProfile | undefined {
  if (!rawProfile || typeof rawProfile !== 'object') {
    return undefined;
  }

  const candidate = rawProfile as Record<string, unknown>;
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  const connection = sanitizeConnection(candidate.connection);

  if (!id || !connection) {
    return undefined;
  }

  return {
    id,
    name: name || inferProfileName(connection),
    connection
  };
}

function sanitizeConnection(rawConnection: unknown): SonarConnection | undefined {
  if (!rawConnection || typeof rawConnection !== 'object') {
    return undefined;
  }

  const candidate = rawConnection as Record<string, unknown>;
  let type: SonarConnection['type'] | undefined;
  if (candidate.type === 'server') {
    type = 'server';
  } else if (candidate.type === 'cloud') {
    type = 'cloud';
  }
  const baseUrl = typeof candidate.baseUrl === 'string' ? candidate.baseUrl.trim() : '';
  const projectKey = typeof candidate.projectKey === 'string' ? candidate.projectKey.trim() : '';
  const organization = typeof candidate.organization === 'string' ? candidate.organization.trim() : '';
  const branch = typeof candidate.branch === 'string' ? candidate.branch.trim() : '';
  const pullRequest = typeof candidate.pullRequest === 'string' ? candidate.pullRequest.trim() : '';
  const verifyTls = typeof candidate.verifyTls === 'boolean' ? candidate.verifyTls : true;
  const authMode = candidate.authMode === 'basicToken' ? 'basicToken' : 'bearer';

  if (!type) {
    return undefined;
  }

  return {
    type,
    baseUrl,
    projectKey,
    organization: organization || undefined,
    branch: branch || undefined,
    pullRequest: pullRequest || undefined,
    verifyTls,
    authMode
  };
}

function normalizeConnection(connection: SonarConnection): SonarConnection {
  return {
    type: connection.type,
    baseUrl: connection.baseUrl.trim(),
    projectKey: connection.projectKey.trim(),
    organization: connection.organization?.trim() || undefined,
    branch: connection.branch?.trim() || undefined,
    pullRequest: connection.pullRequest?.trim() || undefined,
    verifyTls: connection.verifyTls ?? true,
    authMode: connection.authMode ?? 'bearer'
  };
}

function inferProfileName(connection: SonarConnection): string {
  const base = connection.projectKey || connection.baseUrl || 'Sonar Connection';
  return connection.type === 'cloud' ? `${base} (Cloud)` : `${base} (Server)`;
}
