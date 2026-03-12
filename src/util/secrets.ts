import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

const SECRET_KEY = 'sonarPromptFixer.token';

export async function storeToken(secrets: vscode.SecretStorage, token: string, profileId?: string): Promise<void> {
  await secrets.store(getSecretKey(profileId), token.trim());
}

export async function loadStoredToken(secrets: vscode.SecretStorage, profileId?: string): Promise<string | undefined> {
  return secrets.get(getSecretKey(profileId));
}

export async function loadToken(
  secrets: vscode.SecretStorage,
  extensionPath?: string,
  profileId?: string
): Promise<string | undefined> {
  const storedToken = await loadStoredToken(secrets, profileId);
  if (storedToken) {
    return storedToken;
  }

  return loadTokenFromEnv(extensionPath);
}

export async function deleteToken(secrets: vscode.SecretStorage, profileId?: string): Promise<void> {
  await secrets.delete(getSecretKey(profileId));
}

function loadTokenFromEnv(extensionPath?: string): string | undefined {
  for (const rootPath of getSearchRoots(extensionPath)) {
    const envPath = path.join(rootPath, '.env');
    if (!fs.existsSync(envPath)) {
      continue;
    }

    const token = parseEnvToken(fs.readFileSync(envPath, 'utf8'));
    if (token) {
      return token;
    }
  }

  return undefined;
}

function parseEnvToken(fileContent: string): string | undefined {
  for (const rawLine of fileContent.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (key !== 'SONAR_TOKEN' || !value) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    return value || undefined;
  }

  return undefined;
}

function getSearchRoots(extensionPath?: string): string[] {
  const workspaceRoots = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
  const roots = extensionPath ? [...workspaceRoots, extensionPath] : workspaceRoots;

  return [...new Set(roots)];
}

function getSecretKey(profileId?: string): string {
  return profileId ? `${SECRET_KEY}.${profileId}` : SECRET_KEY;
}
