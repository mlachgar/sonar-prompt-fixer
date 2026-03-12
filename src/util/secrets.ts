import * as vscode from 'vscode';

const SECRET_KEY = 'sonarPromptFixer.token';

export async function storeToken(secrets: vscode.SecretStorage, token: string): Promise<void> {
  await secrets.store(SECRET_KEY, token.trim());
}

export async function loadToken(secrets: vscode.SecretStorage): Promise<string | undefined> {
  return secrets.get(SECRET_KEY);
}

export async function deleteToken(secrets: vscode.SecretStorage): Promise<void> {
  await secrets.delete(SECRET_KEY);
}
