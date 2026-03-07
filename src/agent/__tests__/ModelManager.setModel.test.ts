import { describe, expect, it, mock } from 'bun:test';
import type { ChatConfig } from '../../services/ChatServiceInterface.js';
import type { BladeConfig, ModelConfig } from '../../types/common.js';

const mockCreateChatServiceAsync = mock(async (config: ChatConfig) => ({
  chat: mock(async () => ({ content: 'ok' })),
  streamChat: mock(async function* () {}),
  getConfig: () => config,
  updateConfig: mock(() => {}),
}));

mock.module('../../services/ChatServiceInterface.js', () => ({
  createChatServiceAsync: mockCreateChatServiceAsync,
}));

const { ModelManager } = await import('../ModelManager.js');

function createModelConfig(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'default',
    name: 'gpt-4o-mini',
    model: 'gpt-4o-mini',
    provider: 'openai-compatible',
    apiKey: 'test-key',
    baseUrl: 'https://api.test.com',
    maxContextTokens: 128000,
    ...overrides,
  };
}

describe('ModelManager.setModel', () => {
  it('should update the active model name for subsequent turns', async () => {
    const config: BladeConfig = {
      models: [createModelConfig()],
      currentModelId: 'default',
    };
    const manager = new ModelManager(config);

    await manager.applyModelConfig(config.models[0]!, 'init');
    await manager.setModel('gpt-4.1');

    expect(manager.getChatService().getConfig().model).toBe('gpt-4.1');
    expect(config.models[0]?.model).toBe('gpt-4.1');
  });
});
