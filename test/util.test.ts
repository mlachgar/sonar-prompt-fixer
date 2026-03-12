import { describe, expect, it } from 'vitest';
import { mapConnectionError } from '../src/util/diagnostics';
import { ConfigurationError, HttpError, isErrorWithCode } from '../src/util/errors';
import { deleteToken, loadToken, storeToken } from '../src/util/secrets';
import { createSecretStorage } from './vscodeMock';

describe('diagnostics and error helpers', () => {
  it('maps HTTP status failures into connection diagnostics', () => {
    expect(mapConnectionError(new HttpError('Forbidden', 403, 'denied'))).toEqual({
      ok: false,
      kind: 'auth',
      message: 'Authentication failed. Check that your token is valid and has access to the project.',
      details: 'denied'
    });

    expect(mapConnectionError(new HttpError('Missing', 404, 'missing'))).toEqual({
      ok: false,
      kind: 'notFound',
      message: 'The Sonar API endpoint was not found. Verify the base URL and that it points to the Sonar root.',
      details: 'missing'
    });

    expect(mapConnectionError(new HttpError('Oops', 500, 'body'))).toEqual({
      ok: false,
      kind: 'unknown',
      message: 'Sonar API request failed with status 500.',
      details: 'body'
    });
  });

  it('maps network, TLS, and unknown failures', () => {
    expect(mapConnectionError({ code: 'ENOTFOUND', message: 'dns down' })).toEqual({
      ok: false,
      kind: 'network',
      message: 'Unable to reach the Sonar host. Check the URL, DNS, VPN, or network access.',
      details: 'dns down'
    });

    expect(mapConnectionError({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT', message: 'bad cert' })).toEqual({
      ok: false,
      kind: 'tls',
      message: 'TLS certificate validation failed. Verify the certificate chain or disable TLS verification only if you trust the server.',
      details: 'bad cert'
    });

    expect(mapConnectionError({ code: 'ERR_TLS_CERT_ALTNAME_INVALID', message: 'alt name invalid' })).toEqual({
      ok: false,
      kind: 'tls',
      message: 'TLS certificate validation failed. Verify the certificate chain or disable TLS verification only if you trust the server.',
      details: 'alt name invalid'
    });

    expect(mapConnectionError(new Error('mystery'))).toEqual({
      ok: false,
      kind: 'unknown',
      message: 'mystery'
    });

    expect(mapConnectionError('plain value')).toEqual({
      ok: false,
      kind: 'unknown',
      message: 'Unknown error while testing the Sonar connection.'
    });
  });

  it('exposes error helper behavior', () => {
    const httpError = new HttpError('boom', 400, 'body');
    expect(httpError.statusCode).toBe(400);
    expect(httpError.responseBody).toBe('body');
    expect(isErrorWithCode({ code: 'X' })).toBe(true);
    expect(isErrorWithCode(null)).toBe(false);
    expect(new ConfigurationError('bad config')).toBeInstanceOf(Error);
  });
});

describe('secret helpers', () => {
  it('stores, loads, and deletes the token', async () => {
    const secrets = createSecretStorage();

    await storeToken(secrets as never, '  token-value  ');
    await expect(loadToken(secrets as never)).resolves.toBe('token-value');

    await deleteToken(secrets as never);
    await expect(loadToken(secrets as never)).resolves.toBeUndefined();
  });
});
