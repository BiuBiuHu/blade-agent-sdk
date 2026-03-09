import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let capturedConfig: { models?: Record<string, unknown>[] } | undefined;

mock.module('../../agent/Agent.js', () => ({
  Agent: {
    create: mock(async () => ({})),
  },
}));

mock.module('../SessionRuntime.js', () => ({
  SessionRuntime: class MockSessionRuntime {
    constructor(
      _sessionId: string,
      _options: unknown,
      config: { models?: Record<string, unknown>[] },
    ) {
      capturedConfig = config;
    }

    async initialize(): Promise<void> {}

    async ensureSessionCreated(): Promise<void> {}

    getAgentRuntimeDeps() {
      return {};
    }

    getHookCallbacks() {
      return {};
    }

    async close(): Promise<void> {}
  },
}));

const { createSession } = await import('../Session.js');

describe('Session OpenAI config', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'session-openai-config-'));
    capturedConfig = undefined;
  });

  it('stores native openai models with the official base url and forwarded headers', async () => {
    const session = await createSession({
      provider: {
        type: 'openai',
        apiKey: 'test-key',
        headers: {
          'X-Test': '1',
        },
        organization: 'org-test',
        projectId: 'proj-test',
      },
      model: 'gpt-5',
      cwd: workspaceRoot,
    });

    expect(capturedConfig?.models?.[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-5',
      baseUrl: 'https://api.openai.com/v1',
      headers: {
        'X-Test': '1',
        'OpenAI-Organization': 'org-test',
        'OpenAI-Project': 'proj-test',
      },
    });

    session.close();
  });
});
