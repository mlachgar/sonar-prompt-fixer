# Self-Hosted SonarQube Testing

This project has been tested end-to-end with SonarQube Cloud.

Self-hosted SonarQube Server was later validated locally with Docker and a manually created project, but coverage of self-hosted setups is still narrower than SonarQube Cloud.

## Current Validation Status

- Verified manually with SonarQube Cloud
- Verified manually against a local self-hosted SonarQube Server
- Covered in unit tests for server-specific backend paths
- Not yet validated across multiple real-world self-hosted SonarQube versions, editions, proxies, and permission models

## Key Findings From Local Self-Hosted Testing

- Connection test can succeed even when some feature-specific APIs fail later.
- A user token worked reliably for local testing.
- A project token was not sufficient for all requests in the extension.
- Some SonarQube APIs can fail independently because of permissions or edition capabilities.
- The extension now degrades per section, so a failing coverage, duplication, or hotspots request does not prevent issues from loading.

## What To Test On A Self-Hosted Server

Validate these scenarios against the target server:

- successful connection with a valid server URL, user token, and project key
- invalid token handling
- wrong project key handling
- unreachable or malformed server URL handling
- TLS validation behavior, especially with self-signed certificates
- startup preload when the active profile is already valid
- profile switching and refresh behavior in the Findings sidebar
- prompt generation in all workspace modes:
  - Issues
  - Coverage
  - Duplication
  - Security Hotspots
- partial failure handling when only some Sonar APIs are accessible

## Recommended Local Test Setup

If you want to test self-hosted SonarQube locally, the quickest option is Docker:

```bash
docker run -d --name sonarqube -p 9000:9000 sonarqube:community
```

Then:

1. Open `http://localhost:9000`
2. Complete the initial SonarQube setup
3. Create a project manually
4. Generate a user token
5. Run a local scan to populate the project:

```bash
sonar-scanner \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=YOUR_USER_TOKEN \
  -Dsonar.projectKey=YOUR_PROJECT_KEY \
  -Dsonar.sources=.
```

6. Configure the extension profile with:
   - `type = server`
   - `baseUrl = http://localhost:9000`
   - `projectKey = <your-project-key>`
   - `authMode = basicToken`

## Useful Request Checks

Use `curl` to confirm the same APIs the extension depends on:

```bash
curl -u YOUR_USER_TOKEN: http://localhost:9000/api/authentication/validate
```

```bash
curl -u YOUR_USER_TOKEN: \
  "http://localhost:9000/api/components/search?qualifiers=TRK&q=YOUR_PROJECT_KEY"
```

```bash
curl -u YOUR_USER_TOKEN: \
  "http://localhost:9000/api/issues/search?componentKeys=YOUR_PROJECT_KEY&statuses=OPEN,CONFIRMED,REOPENED&ps=500"
```

```bash
curl -u YOUR_USER_TOKEN: \
  "http://localhost:9000/api/measures/component_tree?component=YOUR_PROJECT_KEY&qualifiers=FIL&metricKeys=coverage,line_coverage,branch_coverage,lines_to_cover,uncovered_lines,conditions_to_cover,uncovered_conditions&ps=500"
```

```bash
curl -u YOUR_USER_TOKEN: \
  "http://localhost:9000/api/measures/component_tree?component=YOUR_PROJECT_KEY&qualifiers=FIL&metricKeys=duplicated_lines_density,duplicated_lines,duplicated_blocks&ps=500"
```

```bash
curl -u YOUR_USER_TOKEN: \
  "http://localhost:9000/api/hotspots/search?projectKey=YOUR_PROJECT_KEY&status=TO_REVIEW&ps=500"
```

If one of these fails with `Insufficient privileges`, the request format is likely fine and the problem is token scope or project permissions.

## Suggested QA Note

Use wording like this in release notes or PR notes:

> Manual validation was completed with SonarQube Cloud and a local self-hosted SonarQube Server. Self-hosted support works for the tested local setup, but broader validation across different server versions, editions, and permission models is still recommended.
