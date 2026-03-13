# Sonar Prompt Fixer

Sonar Prompt Fixer is a VS Code extension that connects to SonarQube Cloud or a self-hosted SonarQube Server, fetches project findings, and generates remediation prompts for coding agents such as Codex, Claude Code, and Qwen Code. The main workflow lives in a dedicated Sonar Workspace, while the sidebar provides a lightweight Findings summary.

## What You Get

- Connect to SonarQube Cloud or SonarQube Server from inside VS Code
- Review findings in a dedicated Sonar Workspace with focused modes
- Generate prompts for Codex, Claude Code, and Qwen Code from selected findings
- Keep tokens out of plain settings by storing them in VS Code `SecretStorage`

## Features

- Unified connection model for SonarQube Cloud and SonarQube Server
- Secure token storage with VS Code `SecretStorage`
- Automatic configuration prefill from `sonar-project.properties` when project key or organization are not yet set
- Automatic token fallback from `.env` when `SONAR_TOKEN` is present and no token is stored yet
- One-time onboarding hint that points first-time users to the Activity Bar entry
- Configuration editor opened from the Findings view
- Findings summary view with click-through entry points into each workspace mode
- Findings sidebar webview with:
  - profile selector
  - refresh control
  - loading state
  - summary counts for each workspace mode
- Sonar Workspace modes: `Issues`, `Coverage`, `Duplication`, `Security Hotspots`
- KPI summary chips for coverage, duplication, and security review metrics
- Canonical prompt builder with lightweight renderers for:
  - Codex
  - Claude Code
  - Qwen Code
- Real connection diagnostics for network, TLS, auth, and project validation failures

## Getting Started

1. Install the extension from the VS Code Marketplace.
2. Open the `Sonar Prompt Fixer` view from the Activity Bar.
3. Open the configuration editor from the `Findings` view title.
4. Add a SonarQube Cloud or SonarQube Server connection profile.
5. Save your token securely in the editor and test the connection.
6. Refresh the Findings view and open the Sonar Workspace.
7. Select findings in a workspace mode and generate a prompt for your coding agent.

When available, the extension prefills configuration from:

- `sonar-project.properties`
- local `.env` via `SONAR_TOKEN`

## How To Use

The extension is organized around two surfaces:

- `Findings` sidebar for profile switching, refresh, and summary counts
- `Sonar Workspace` editor for filtering, selection, and prompt generation

Typical flow:

1. Open the `Findings` sidebar.
2. Choose or create a connection profile.
3. Validate the connection and load findings.
4. Open the matching workspace mode from a summary card or command.
5. Filter and select the issues, coverage gaps, duplications, or hotspots you want to address.
6. Generate a prompt for `Codex`, `Claude Code`, or `Qwen Code`.
7. Copy the generated prompt into your coding agent workflow.

## Configuration

The extension stores connection profiles in VS Code settings under `sonarPromptFixer.connections.*`.

Key settings:

- `sonarPromptFixer.connections.profiles`
- `sonarPromptFixer.connections.activeProfileId`
- `sonarPromptFixer.groupBy`
- `sonarPromptFixer.prompt.defaultTarget`
- `sonarPromptFixer.prompt.defaultStyle`

You can manage profiles from the configuration editor opened from the `Findings` view. When no profile has been saved yet, the editor starts from these defaults:

- `projectKey` from `sonar.projectKey` in `sonar-project.properties`
- `organization` from `sonar.organization` in `sonar-project.properties`

Saved profiles become the source of truth for Sonar connections.

When a saved active profile is valid and has a token, the extension preloads findings on startup.

## Secure Token Storage

Do not store your Sonar token in plain settings.

Use the configuration editor to save or remove the token. The token is stored in VS Code `SecretStorage`. Enter an empty value to delete the stored token.

If no token is stored yet, the extension also tries to read `SONAR_TOKEN` from a local `.env` file in the workspace or extension root.

## Commands

- `Sonar Prompt Fixer: Open Configuration Editor`
- `Sonar Prompt Fixer: Open Sonar Workspace`

These are the only public commands. Day-to-day work such as filtering, selection, prompt generation, and prompt copying happens inside the workspace UI.

## Workspace Modes

The editor-based workspace is the main place to work with Sonar data.

It provides:
- `Issues` mode for filtering and selecting open Sonar issues
- `Coverage` mode for uncovered lines and branch gaps
- `Duplication` mode for duplicated files and refactoring targets
- `Security Hotspots` mode for hotspot remediation
- KPI chips for coverage, duplication, and security review metrics

Each mode has its own filters and selection set, but all four share the same step flow:

1. Select the findings or targets to include.
2. Generate a prompt tailored to the current mode.

The workspace keeps prompt generation explicit:

- `Generate Prompt` from step 1 opens step 2 and generates the prompt immediately with the current target and style
- `Re-Generate Prompt` refreshes the prompt in step 2
- `Select Visible` only changes selection; it does not generate a prompt

## Prompt Generation

Prompt generation uses one canonical input model with:
- selected normalized Sonar data
- active prompt target
- active prompt style
- current connection metadata

Supported prompt sources:
- Sonar issues
- coverage targets
- duplication targets
- security hotspots

Each renderer keeps the same selected content while adapting tone, structure, and output contract wording.

Supported targets:

- Codex
- Claude Code
- Qwen Code

Supported styles:

- `minimal`
- `balanced`
- `guided`

## Extension Settings

The main user-facing settings are:

- `sonarPromptFixer.connections.profiles`
- `sonarPromptFixer.connections.activeProfileId`
- `sonarPromptFixer.groupBy`
- `sonarPromptFixer.prompt.defaultTarget`
- `sonarPromptFixer.prompt.defaultStyle`

Most users can manage connection data from the built-in configuration editor instead of editing JSON manually.

## Development

1. Install dependencies:

```bash
npm install
```

2. Compile the extension:

```bash
npm run compile
```

Optional but recommended quality checks:

```bash
npm run test:coverage
```

3. Open this folder in VS Code.
4. Press `F5` to launch the Extension Development Host.
5. On first activation, the extension shows a one-time onboarding hint with shortcuts to configuration and the Sonar Workspace.
6. In the new window, open the `Sonar Prompt Fixer` sidebar.
7. Use the profile selector in the `Findings` view or open the configuration editor from the view title.
8. Review the prefilled values from `sonar-project.properties` and `.env` if those files exist.
9. Save your profile and token, then test the connection from the configuration editor.
10. Refresh the Findings sidebar if needed and confirm the summary counts load.
11. Click a summary card or use the workspace button to open the editor-based Sonar Workspace.
12. Choose a mode: `Issues`, `Coverage`, `Duplication`, or `Security Hotspots`.
13. Use step 1 to filter and select the relevant items.
14. Move to step 2 to generate and copy the prompt.

## How To Test

- Verify both `cloud` and `server` connections if you have access to each.
- Confirm connection diagnostics for:
  - bad URL
  - invalid token
  - wrong project key
  - self-signed certificate setup
- Confirm empty configuration is prefilled from `sonar-project.properties` when available.
- Confirm a stored token still takes precedence over `.env`.
- Confirm the onboarding hint appears once on first activation and does not block startup.
- Confirm findings preload on startup when the active profile is already valid.
- In `Issues` mode, fetch issues and test local filtering by:
  - type
  - severity
  - status
  - rule substring
  - file/component substring
- In `Coverage` mode, confirm the table lists uncovered files and shows:
  - coverage
  - line coverage
  - branch coverage
  - uncovered lines
  - uncovered branches
- In `Duplication` mode, confirm the table lists duplicated files and shows:
  - duplication percentage
  - duplicated lines
  - duplicated blocks
- In `Security Hotspots` mode, confirm the table lists:
  - probability
  - status
  - relative location
  - message
- Confirm KPI chips render at the top of the workspace.
- Use the workspace for bulk selection and wider review.
- Confirm the tables show relative locations without unwanted horizontal scrolling.
- Confirm the status combobox shows all status options cleanly.
- Generate prompts in all four workspace modes for all three coding-agent targets and copy them from the prompt panel.
- Confirm the Findings summary shows counts for each workspace mode and resets while refreshing.
- Confirm the Findings profile selector switches profiles and reloads summary counts.
- Confirm each Findings summary card opens the matching workspace mode.

## GitHub CI And SonarQube Cloud

The repository includes a GitHub Actions workflow at [`.github/workflows/ci.yml`](/Users/mohamedlachgar/Dev/Git/sonar-prompt-fixer/.github/workflows/ci.yml) and a shared Sonar configuration at [`sonar-project.properties`](/Users/mohamedlachgar/Dev/Git/sonar-prompt-fixer/sonar-project.properties).

Before the scan can run successfully, configure these GitHub repository settings:

- Secret: `SONAR_TOKEN`

Project identity is read from [`sonar-project.properties`](/Users/mohamedlachgar/Dev/Git/sonar-prompt-fixer/sonar-project.properties), including:

- `sonar.organization`
- `sonar.projectKey`

If `SONAR_TOKEN` is missing, the CI workflow still runs build and tests but skips the SonarQube Cloud scan with a clear log message.

The workflow currently:

- installs dependencies with `npm ci`
- compiles the extension with `npm run compile`
- runs unit tests with coverage via `npm run test:coverage`
- runs a SonarQube Cloud scan on push, pull request, and manual dispatch

Recommended coverage strategy for this codebase:
- keep UI code in Sonar analysis
- exclude VS Code integration layers and webview template files from coverage until they have stable tests
- keep core logic such as prompt rendering, Sonar mapping, and state/filter logic in coverage scope

## Known Limitations

- Issue, coverage, duplication, and hotspot fetching are currently single-page requests capped at 500 items.
- Filtering is local and in-memory after fetch.
- Rule metadata is fetched through the backend abstraction but is not yet surfaced in the UI.
- The Findings sidebar is intentionally summary-only; rich filtering, selection, and prompt actions live in the Sonar Workspace.
- Some self-hosted SonarQube endpoints can fail independently because of permissions or edition capabilities; the sidebar degrades per section instead of failing entirely.
- The webview is intentionally lightweight and does not use an external frontend framework.

## Release Notes

See the project history and tagged releases on GitHub:

- [Releases](https://github.com/mlachgar/sonar-prompt-fixer/releases)

## Architecture Overview

Recommended maintainable MVP layout:

- `src/sonar`
  - provider abstraction, HTTP client, backends, normalized mappers, and Sonar types
- `src/state`
  - connection, filter, and selection state
- `src/providers`
  - Sonar data loading and normalization used by the sidebar summary and workspace
- `src/prompt`
  - canonical prompt model and target-specific renderers
- `src/webview`
  - configuration editor panel, Findings sidebar webview, and Sonar workspace editor
- `src/commands`
  - lightweight entry-point command registration modules

## Roadmap Ideas

- Server-side filtering and pagination
- Snippet/context capture around issue lines
- Rule detail drill-down in the tree or webview
- Retry and backoff for transient network or rate-limit failures
- Additional grouping modes and saved issue sets
- Repo-aware prompt enrichment and AGENTS.md guidance integration
