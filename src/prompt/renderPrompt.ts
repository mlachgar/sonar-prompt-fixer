import { CanonicalPromptInput } from './types';
import { renderClaudePrompt } from './renderClaudePrompt';
import { renderCodexPrompt } from './renderCodexPrompt';
import { renderQwenPrompt } from './renderQwenPrompt';

export function renderPrompt(input: CanonicalPromptInput): string {
  switch (input.target) {
    case 'claude':
      return renderClaudePrompt(input);
    case 'qwen':
      return renderQwenPrompt(input);
    case 'codex':
    default:
      return renderCodexPrompt(input);
  }
}
