import * as http from 'node:http';
import * as https from 'node:https';
import { URL } from 'node:url';
import { SonarConnection } from './types';
import { HttpError } from '../util/errors';

type QueryValue = string | number | boolean | undefined;

export class SonarHttpClient {
  public constructor(
    private readonly connection: SonarConnection,
    private readonly token: string
  ) {}

  public async getJson<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
    const response = await this.request('GET', path, query);
    return JSON.parse(response) as T;
  }

  public async getText(path: string, query: Record<string, QueryValue> = {}): Promise<string> {
    return this.request('GET', path, query);
  }

  private async request(method: string, path: string, query: Record<string, QueryValue>): Promise<string> {
    const url = new URL(path, ensureTrailingSlash(this.connection.baseUrl));

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const headers: Record<string, string> = {
      Accept: 'application/json'
    };

    if (this.connection.type === 'server' && this.connection.authMode === 'basicToken') {
      const encodedToken = Buffer.from(`${this.token}:`).toString('base64');
      headers.Authorization = `Basic ${encodedToken}`;
    } else {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return new Promise<string>((resolve, reject) => {
      const req = transport.request(
        url,
        {
          method,
          headers,
          rejectUnauthorized: this.connection.verifyTls !== false
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            if ((res.statusCode ?? 500) >= 400) {
              reject(new HttpError(`Request failed for ${url.pathname}`, res.statusCode ?? 500, body));
              return;
            }
            resolve(body);
          });
        }
      );

      req.on('error', reject);
      req.end();
    });
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
