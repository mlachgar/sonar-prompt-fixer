import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { parseSonarProjectProperties } from './sonarProjectProperties';

export type SonarWorkspaceProject = {
  directory: string;
  label: string;
  projectKey: string;
  organization?: string;
  propertiesPath: string;
};

export function discoverSonarWorkspaceProjects(extensionPath?: string): SonarWorkspaceProject[] {
  const workspaceRoots = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
  const searchRoots = workspaceRoots.length > 0 ? workspaceRoots : extensionPath ? [extensionPath] : [];
  const projects: SonarWorkspaceProject[] = [];
  const seenPropertiesPaths = new Set<string>();

  for (const rootPath of searchRoots) {
    for (const propertiesPath of getCandidatePropertiesPaths(rootPath)) {
      const normalizedPath = path.normalize(propertiesPath);
      if (seenPropertiesPaths.has(normalizedPath) || !fs.existsSync(normalizedPath)) {
        continue;
      }

      seenPropertiesPaths.add(normalizedPath);
      const fileContent = fs.readFileSync(normalizedPath, 'utf8');
      const parsed = parseSonarProjectProperties(fileContent);
      if (!parsed.projectKey) {
        continue;
      }

      const directory = path.dirname(normalizedPath);
      projects.push({
        directory,
        label: getProjectLabel(rootPath, directory),
        projectKey: parsed.projectKey,
        organization: parsed.organization,
        propertiesPath: normalizedPath
      });
    }
  }

  return projects;
}

function getCandidatePropertiesPaths(rootPath: string): string[] {
  const candidates = [path.join(rootPath, 'sonar-project.properties')];

  try {
    const entries = fs.readdirSync(rootPath, { withFileTypes: true });
    const childDirectories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    for (const directoryName of childDirectories) {
      candidates.push(path.join(rootPath, directoryName, 'sonar-project.properties'));
    }
  } catch {
    return candidates;
  }

  return candidates;
}

function getProjectLabel(rootPath: string, directory: string): string {
  const relativeDirectory = path.relative(rootPath, directory);
  if (!relativeDirectory) {
    return path.basename(directory) || directory;
  }

  return relativeDirectory.split(path.sep).join('/');
}
