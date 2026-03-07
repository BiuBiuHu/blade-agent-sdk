import { describe, expect, it } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PersistentStore } from '../../context/storage/PersistentStore.js';
import { JsonlSessionStore } from '../SessionStore.js';

describe('JsonlSessionStore', () => {
  it('should preserve message ids when loading session history', async () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'session-store-test-'));
    const persistentStore = new PersistentStore(workspaceRoot);
    const sessionStore = new JsonlSessionStore(workspaceRoot);

    const sessionId = 'session-1';
    const userMessageId = await persistentStore.saveMessage(sessionId, 'user', 'hello');
    const assistantMessageId = await persistentStore.saveMessage(
      sessionId,
      'assistant',
      'world',
      userMessageId,
    );

    const messages = await sessionStore.loadMessages(sessionId);

    expect(messages).toHaveLength(2);
    expect(messages[0]?.id).toBe(userMessageId);
    expect(messages[1]?.id).toBe(assistantMessageId);
  });
});
