import type { RuntimeContext } from './RuntimeContext.js';

export function getContextCwd(
  context?: RuntimeContext,
): string | undefined {
  return context?.capabilities?.filesystem?.cwd;
}

export function getContextRoots(
  context?: RuntimeContext,
): string[] {
  return context?.capabilities?.filesystem?.roots ?? [];
}
