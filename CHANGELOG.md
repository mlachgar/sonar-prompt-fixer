# Changelog

All notable changes to this project will be documented in this file.

## 0.0.2

- Refactored saved Sonar profiles to store only server-level connection settings.
- Resolved `projectKey` and `organization` from workspace `sonar-project.properties` files at runtime.
- Added workspace project discovery for `/sonar-project.properties` and `/*/sonar-project.properties`.
- Added a workspace-level project selector with persisted active project path and automatic first-project selection.
- Rescanned projects and connection suggestions when workspace folders change.
- Added a SonarCloud connection suggestion flow when a valid local connection is detected and no saved profile exists yet.
- Updated the Findings sidebar to show only saved profiles and hide summary cards until findings are loaded.
- Added the `Sonar Prompt Fixer: Reset Connections And Projects` command.
- Reworked the configuration editor layout and clarified detected-project information.
- Expanded tests and documentation for the new connection and project-selection behavior.

## 0.0.1

- Initial public release of Sonar Prompt Fixer.
- Connects to SonarQube Cloud and SonarQube Server.
- Provides Findings sidebar summary and Sonar Workspace modes.
- Generates remediation prompts for Codex, Claude Code, and Qwen Code.
