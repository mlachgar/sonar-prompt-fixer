import { HttpError, isErrorWithCode } from './errors';
import { ConnectionTestResult } from '../sonar/types';

export function mapConnectionError(error: unknown): ConnectionTestResult {
  if (error instanceof HttpError) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return {
        ok: false,
        kind: 'auth',
        message: 'Authentication failed. Check that your token is valid and has access to the project.',
        details: error.responseBody
      };
    }

    if (error.statusCode === 404) {
      return {
        ok: false,
        kind: 'notFound',
        message: 'The Sonar API endpoint was not found. Verify the base URL and that it points to the Sonar root.',
        details: error.responseBody
      };
    }

    return {
      ok: false,
      kind: 'unknown',
      message: `Sonar API request failed with status ${error.statusCode}.`,
      details: error.responseBody
    };
  }

  if (isErrorWithCode(error)) {
    if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return {
        ok: false,
        kind: 'network',
        message: 'Unable to reach the Sonar host. Check the URL, DNS, VPN, or network access.',
        details: error.message
      };
    }

    if (error.code?.includes('CERT') || error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
      return {
        ok: false,
        kind: 'tls',
        message: 'TLS certificate validation failed. Verify the certificate chain or disable TLS verification only if you trust the server.',
        details: error.message
      };
    }
  }

  return {
    ok: false,
    kind: 'unknown',
    message: error instanceof Error ? error.message : 'Unknown error while testing the Sonar connection.'
  };
}
