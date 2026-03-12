import { SonarBackend } from './SonarBackend';
import { SonarCloudBackend } from './SonarCloudBackend';
import { SonarQubeServerBackend } from './SonarQubeServerBackend';
import { SonarConnection } from './types';
import { ConfigurationError } from '../util/errors';

export function createSonarBackend(connection: SonarConnection, token: string | undefined): SonarBackend {
  if (!connection.baseUrl || !connection.projectKey) {
    throw new ConfigurationError('Configure the Sonar base URL and project key first.');
  }

  if (!token) {
    throw new ConfigurationError('No Sonar token is stored yet. Run "Sonar Prompt Fixer: Set Token".');
  }

  if (connection.type === 'cloud') {
    return new SonarCloudBackend(connection, token);
  }

  return new SonarQubeServerBackend(connection, token);
}
