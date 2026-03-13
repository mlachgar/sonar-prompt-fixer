import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { SonarConnection, SonarConnectionProfile, SonarProfileConnection } from '../sonar/types';
import { deleteToken, loadStoredToken, loadToken, storeToken } from '../util/secrets';
import { SonarProjectProperties } from '../util/sonarProjectProperties';
import { discoverSonarWorkspaceProjects, SonarWorkspaceProject } from '../util/sonarWorkspaceProjects';

const PROFILES_SECTION = 'connections.profiles';
const ACTIVE_PROFILE_SECTION = 'connections.activeProfileId';
const ACTIVE_PROJECT_SECTION = 'projects.activeProjectPath';
const DEFAULT_PROFILE_CONNECTION: SonarProfileConnection = {
  type: 'cloud',
  baseUrl: 'https://sonarcloud.io',
  branch: undefined,
  pullRequest: undefined,
  verifyTls: true,
  authMode: 'bearer'
};

export class ConnectionState {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;
  private profiles: SonarConnectionProfile[];
  private activeProfileId: string;
  private activeProjectPath: string;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.profiles = this.readStoredProfiles();
    this.activeProfileId = this.readActiveProfileId(this.profiles);
    this.activeProjectPath = this.readActiveProjectPath();
  }

  public getConnection(): SonarConnection {
    return this.resolveConnection();
  }

  public hasSavedProfiles(): boolean {
    return this.profiles.length > 0;
  }

  public getProjectConfiguration(): SonarProjectProperties {
    const activeProject = this.getActiveProject();
    if (!activeProject) {
      return {};
    }

    return {
      projectKey: activeProject.projectKey,
      organization: activeProject.organization
    };
  }

  public resolveConnection(connection?: SonarProfileConnection): SonarConnection {
    const activeConnection = connection ?? this.getActiveProfile()?.connection ?? this.getDefaultProfileConnection();
    const projectConfiguration = this.getProjectConfiguration();

    return {
      ...normalizeConnection(activeConnection),
      projectKey: projectConfiguration.projectKey || '',
      organization: projectConfiguration.organization || undefined
    };
  }

  public getProjects(): SonarWorkspaceProject[] {
    return discoverSonarWorkspaceProjects(this.context.extensionPath);
  }

  public getActiveProjectPath(): string {
    const activeProject = this.getActiveProject();
    return activeProject?.directory ?? '';
  }

  public getActiveProject(): SonarWorkspaceProject | undefined {
    const projects = this.getProjects();
    if (projects.length === 0) {
      return undefined;
    }

    return projects.find((project) => project.directory === this.activeProjectPath) ?? projects[0];
  }

  public async ensureActiveProjectSelection(): Promise<void> {
    const projects = this.getProjects();
    if (projects.length === 0) {
      return;
    }

    if (projects.some((project) => project.directory === this.activeProjectPath)) {
      return;
    }

    await this.setActiveProjectPath(projects[0].directory, false);
  }

  public getProfiles(): SonarConnectionProfile[] {
    return [...this.profiles];
  }

  public getActiveProfileId(): string {
    if (this.profiles.some((profile) => profile.id === this.activeProfileId)) {
      return this.activeProfileId;
    }

    return this.profiles[0]?.id ?? '';
  }

  public getActiveProfile(): SonarConnectionProfile | undefined {
    const activeProfileId = this.getActiveProfileId();
    return this.profiles.find((profile) => profile.id === activeProfileId) ?? this.profiles[0];
  }

  public getDefaultProfileConnection(): SonarProfileConnection {
    return { ...DEFAULT_PROFILE_CONNECTION };
  }

  public async getToken(profileId?: string): Promise<string | undefined> {
    const activeProfileId = profileId ?? this.getActiveProfileId();
    if (activeProfileId) {
      const storedToken = await loadStoredToken(this.context.secrets, activeProfileId);
      if (storedToken) {
        return storedToken;
      }
    }

    return loadToken(this.context.secrets, this.context.extensionPath, activeProfileId || undefined);
  }

  public async updateSetting<T>(section: string, value: T): Promise<void> {
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    await config.update(section, value, vscode.ConfigurationTarget.Global);
    this.onDidChangeEmitter.fire();
  }

  public async saveProfile(
    profile: Partial<SonarConnectionProfile> & { connection: SonarProfileConnection },
    token: string
  ): Promise<SonarConnectionProfile> {
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    const profiles = this.profiles;
    const normalizedConnection = normalizeConnection(profile.connection);
    const nextProfile: SonarConnectionProfile = {
      id: profile.id?.trim() || randomUUID(),
      name: profile.name?.trim() || inferProfileName(normalizedConnection),
      connection: normalizedConnection
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

  public async selectProject(projectPath: string): Promise<void> {
    const project = this.getProjects().find((candidate) => candidate.directory === projectPath);
    if (!project) {
      return;
    }

    await this.setActiveProjectPath(project.directory, true);
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

  public async resetConnectionsAndProjects(): Promise<void> {
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');

    for (const profile of this.profiles) {
      await deleteToken(this.context.secrets, profile.id);
    }

    this.profiles = [];
    this.activeProfileId = '';
    this.activeProjectPath = '';

    await config.update(PROFILES_SECTION, [], vscode.ConfigurationTarget.Global);
    await config.update(ACTIVE_PROFILE_SECTION, '', vscode.ConfigurationTarget.Global);
    await config.update(ACTIVE_PROJECT_SECTION, '', vscode.ConfigurationTarget.Workspace);

    await this.ensureActiveProjectSelection();
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

  private readActiveProjectPath(): string {
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    return config.get<string>(ACTIVE_PROJECT_SECTION, '').trim();
  }

  private async setActiveProjectPath(projectPath: string, emitChange: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration('sonarPromptFixer');
    this.activeProjectPath = projectPath;
    await config.update(ACTIVE_PROJECT_SECTION, projectPath, vscode.ConfigurationTarget.Workspace);
    if (emitChange) {
      this.onDidChangeEmitter.fire();
    }
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

function sanitizeConnection(rawConnection: unknown): SonarProfileConnection | undefined {
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
    branch: branch || undefined,
    pullRequest: pullRequest || undefined,
    verifyTls,
    authMode
  };
}

function normalizeConnection(connection: SonarProfileConnection): SonarProfileConnection {
  return {
    type: connection.type,
    baseUrl: connection.baseUrl.trim(),
    branch: connection.branch?.trim() || undefined,
    pullRequest: connection.pullRequest?.trim() || undefined,
    verifyTls: connection.verifyTls ?? true,
    authMode: connection.authMode ?? 'bearer'
  };
}

function inferProfileName(connection: SonarProfileConnection): string {
  const base = connection.baseUrl || 'Sonar Connection';
  return connection.type === 'cloud' ? `${base} (Cloud)` : `${base} (Server)`;
}
