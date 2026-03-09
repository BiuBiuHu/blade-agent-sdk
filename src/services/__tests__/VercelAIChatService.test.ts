import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { NOOP_LOGGER } from '../../logging/Logger.js';

const mockOpenAIModelFactory = mock((model: string) => ({ provider: 'openai', model }));
const mockCreateOpenAI = mock((_options?: Record<string, unknown>) => mockOpenAIModelFactory);
const mockCompatibleModelFactory = mock((model: string) => ({ provider: 'compatible', model }));
const mockCreateOpenAICompatible = mock((_options?: Record<string, unknown>) => mockCompatibleModelFactory);

mock.module('@ai-sdk/openai', () => ({
  createOpenAI: mockCreateOpenAI,
}));

mock.module('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: mockCreateOpenAICompatible,
}));

const { VercelAIChatService } = await import('../VercelAIChatService.js');

describe('VercelAIChatService', () => {
  beforeEach(() => {
    mockCreateOpenAI.mockClear();
    mockOpenAIModelFactory.mockClear();
    mockCreateOpenAICompatible.mockClear();
    mockCompatibleModelFactory.mockClear();
  });

  it('uses the native OpenAI provider for openai configs', async () => {
    const service = new VercelAIChatService(
      {
        provider: 'openai',
        apiKey: 'test-key',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5',
        customHeaders: {
          'X-Test': '1',
        },
      },
      NOOP_LOGGER,
    );

    await (service as unknown as { initialized: Promise<void> }).initialized;

    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-key',
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'X-Test': '1',
      },
    });
    expect(mockOpenAIModelFactory).toHaveBeenCalledWith('gpt-5');
    expect(mockCreateOpenAICompatible).not.toHaveBeenCalled();
  });
});
