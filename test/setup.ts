import { beforeEach, vi } from 'vitest';
import { createVscodeModule, resetVscodeMock } from './vscodeMock';

vi.mock('vscode', () => createVscodeModule(), { virtual: true });

beforeEach(() => {
  resetVscodeMock();
});
