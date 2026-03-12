# Sonar Prompt Fixer

Sonar Prompt Fixer is a VS Code extension that connects to SonarQube Cloud or a self-hosted SonarQube Server, fetches issues for a configured project, and generates remediation prompts for coding agents such as Codex, Claude Code, and Qwen Code. The primary workflow lives in a dedicated Issues Workspace, while the sidebar stays lightweight and focused on entry points.

## Features

- Unified connection model for SonarQube Cloud and SonarQube Server
- Secure token storage with VS Code `SecretStorage`
- Automatic configuration prefill from `sonar-project.properties` when project key or organization are not yet set
- Automatic token fallback from `.env` when `SONAR_TOKEN` is present and no token is stored yet
- Configuration editor opened from the Issues view
- Lightweight sidebar issue summary with workspace launcher
- Editor-based two-step Issues Workspace for filtering, bulk selection, and prompt generation
- Canonical prompt builder with lightweight renderers for:
  - Codex
  - Claude Code
  - Qwen Code
- Real connection diagnostics for network, TLS, auth, and project validation failures

## Configuration

The extension stores connection settings in VS Code settings under `sonarPromptFixer.*`.

Key settings:

- `sonarPromptFixer.connection.type`: `cloud` or `server`
- `sonarPromptFixer.connection.baseUrl`
- `sonarPromptFixer.connection.projectKey`
- `sonarPromptFixer.connection.organization`
- `sonarPromptFixer.connection.branch`
- `sonarPromptFixer.connection.pullRequest`
- `sonarPromptFixer.connection.verifyTls`
- `sonarPromptFixer.connection.authMode`
- `sonarPromptFixer.groupBy`
- `sonarPromptFixer.prompt.defaultTarget`
- `sonarPromptFixer.prompt.defaultStyle`

You can set these from the configuration editor opened from the `Issues` view.

When the saved configuration is still empty, the extension also tries to prefill:

- `projectKey` from `sonar.projectKey` in `sonar-project.properties`
- `organization` from `sonar.organization` in `sonar-project.properties`

Explicit VS Code settings always win over file-based defaults.

## Secure Token Storage

Do not store your Sonar token in plain settings.

Use the configuration editor to save or remove the token. The token is stored in VS Code `SecretStorage`. Enter an empty value to delete the stored token.

If no token is stored yet, the extension also tries to read `SONAR_TOKEN` from a local `.env` file in the workspace or extension root.

## Commands

- `Sonar Prompt Fixer: Open Configuration Editor`
- `Sonar Prompt Fixer: Open Issues Workspace`

These are the only public commands. Day-to-day work such as filtering, selection, prompt generation, and prompt copying happens inside the workspace UI.

## Prompt Generation

Prompt generation uses one canonical input model:

- selected normalized Sonar issues
- active prompt target
- active prompt style
- current connection metadata

Each target renderer keeps the same semantics and issue content, while adapting:

- tone
- structure
- output contract wording
- autonomy framing

Supported targets:

- Codex
- Claude Code
- Qwen Code

Supported styles:

- `minimal`
- `balanced`
- `guided`

## How To Run

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
5. In the new window, open the `Sonar Prompt Fixer` sidebar.
6. In the `Issues` view, open the configuration editor.
7. Review the prefilled values from `sonar-project.properties` and `.env` if those files exist.
8. Save your settings and token, then test the connection from that editor.
9. In the `Issues` view, click the workspace button to open the editor-based Issues Workspace.
10. Use step 1 of the Issues Workspace to filter issues and select findings.
11. Move to step 2 to generate and copy the prompt.

## How To Test

- Verify both `cloud` and `server` connections if you have access to each.
- Confirm connection diagnostics for:
  - bad URL
  - invalid token
  - wrong project key
  - self-signed certificate setup
- Confirm empty configuration is prefilled from `sonar-project.properties` when available.
- Confirm a stored token still takes precedence over `.env`.
- Fetch issues and test local filtering by:
  - type
  - severity
  - status
  - rule substring
  - file/component substring
- Use the Issues Workspace for bulk selection and wider issue review.
- Confirm the table shows severity, type, status, rule, relative location, and message without unwanted horizontal scrolling.
- Confirm the status combobox shows all status options cleanly.
- Generate prompts for all three targets directly in the Issues Workspace and copy them from the prompt panel.

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

- Issue fetching is currently a single-page request capped at 500 issues.
- Filtering is local and in-memory after fetch.
- Rule metadata is fetched through the backend abstraction but is not yet surfaced in the UI.
- The tree currently groups by one setting at a time: severity or type.
- The sidebar is intentionally lightweight; rich issue filtering and prompt actions live in the Issues Workspace.
- The webview is intentionally lightweight and does not use an external frontend framework.

## Architecture Overview

Recommended maintainable MVP layout:

- `src/sonar`
  - provider abstraction, HTTP client, backends, normalized mappers, and Sonar types
- `src/state`
  - connection, filter, and selection state
- `src/providers`
  - tree data provider for issues
- `src/prompt`
  - canonical prompt model and target-specific renderers
- `src/webview`
  - configuration editor panel and issues workspace editor
- `src/commands`
  - command registration modules

## Roadmap Ideas

- Server-side filtering and pagination
- Snippet/context capture around issue lines
- Rule detail drill-down in the tree or webview
- Retry and backoff for transient network or rate-limit failures
- Additional grouping modes and saved issue sets
- Repo-aware prompt enrichment and AGENTS.md guidance integration
