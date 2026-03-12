import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

type SonarProjectProperties = {
  projectKey?: string;
  organization?: string;
};

export function loadSonarProjectProperties(extensionPath?: string): SonarProjectProperties {
  for (const rootPath of getSearchRoots(extensionPath)) {
    const propertiesPath = path.join(rootPath, 'sonar-project.properties');
    if (!fs.existsSync(propertiesPath)) {
      continue;
    }

    const fileContent = fs.readFileSync(propertiesPath, 'utf8');
    return parseSonarProjectProperties(fileContent);
  }

  return {};
}

export function parseSonarProjectProperties(fileContent: string): SonarProjectProperties {
  const values: SonarProjectProperties = {};

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
    const value = line.slice(separatorIndex + 1).trim();

    if (key === 'sonar.projectKey' && value) {
      values.projectKey = value;
    } else if (key === 'sonar.organization' && value) {
      values.organization = value;
    }
  }

  return values;
}

function getSearchRoots(extensionPath?: string): string[] {
  const workspaceRoots = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
  const roots = extensionPath ? [...workspaceRoots, extensionPath] : workspaceRoots;

  return [...new Set(roots)];
}
