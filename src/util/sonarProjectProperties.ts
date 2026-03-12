import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

type SonarProjectProperties = {
  projectKey?: string;
  organization?: string;
};

export function loadSonarProjectProperties(): SonarProjectProperties {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) {
    return {};
  }

  const propertiesPath = path.join(workspacePath, 'sonar-project.properties');
  if (!fs.existsSync(propertiesPath)) {
    return {};
  }

  const fileContent = fs.readFileSync(propertiesPath, 'utf8');
  return parseSonarProjectProperties(fileContent);
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
