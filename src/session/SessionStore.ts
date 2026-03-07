import { JSONLStore } from '@/context/storage/JSONLStore.js';
import { getSessionFilePath } from '@/context/storage/pathUtils.js';
import type { Message, ToolCall } from '../services/ChatServiceInterface.js';
import type { MessageRole } from '../types/common.js';

interface MessageData {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls: ToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface SessionStore {
  loadMessages(sessionId: string): Promise<Message[]>;
}

export class JsonlSessionStore implements SessionStore {
  constructor(private readonly workspaceRoot: string) {}

  async loadMessages(sessionId: string): Promise<Message[]> {
    const filePath = getSessionFilePath(this.workspaceRoot, sessionId);
    const store = new JSONLStore(filePath);
    const entries = await store.readAll();

    if (entries.length === 0) {
      return [];
    }

    const messageMap = new Map<string, MessageData>();

    for (const entry of entries) {
      if (entry.type === 'message_created') {
        const data = entry.data as { messageId: string; role: MessageRole };
        messageMap.set(data.messageId, {
          id: data.messageId,
          role: data.role,
          content: '',
          toolCalls: [],
        });
        continue;
      }

      if (entry.type !== 'part_created') {
        continue;
      }

      const data = entry.data as {
        messageId: string;
        partType: string;
        payload: Record<string, unknown>;
      };
      let message = messageMap.get(data.messageId);
      if (!message) {
        const inferredRole: MessageRole =
          data.partType === 'tool_result' ? 'tool' : 'assistant';
        message = {
          id: data.messageId,
          role: inferredRole,
          content: '',
          toolCalls: [],
        };
        messageMap.set(data.messageId, message);
      }

      switch (data.partType) {
        case 'text': {
          const payload = data.payload as { text?: string };
          message.content = payload.text ?? '';
          break;
        }
        case 'tool_call': {
          const payload = data.payload as {
            toolCallId: string;
            toolName: string;
            input: unknown;
          };
          const toolCall: ToolCall = {
            id: payload.toolCallId,
            type: 'function',
            function: {
              name: payload.toolName,
              arguments: typeof payload.input === 'string'
                ? payload.input
                : JSON.stringify(payload.input),
            },
          };
          message.toolCalls.push(toolCall);
          break;
        }
        case 'tool_result': {
          const payload = data.payload as {
            toolCallId: string;
            toolName: string;
            output: unknown;
            error?: string | null;
          };
          message.role = 'tool';
          message.toolCallId = payload.toolCallId;
          message.name = payload.toolName;
          if (payload.error) {
            message.content = `Error: ${payload.error}`;
          } else if (payload.output === null || payload.output === undefined) {
            message.content = '';
          } else if (typeof payload.output === 'string') {
            message.content = payload.output;
          } else {
            message.content = JSON.stringify(payload.output);
          }
          break;
        }
        case 'summary': {
          const payload = data.payload as { text?: string };
          message.content = payload.text ?? '';
          break;
        }
        default:
          break;
      }
    }

    return Array.from(messageMap.values()).map((msg): Message => {
      const base: Message = {
        id: msg.id,
        role: msg.role,
        content: msg.content,
      };
      if (msg.toolCalls.length > 0) {
        base.tool_calls = msg.toolCalls;
      }
      if (msg.toolCallId) {
        base.tool_call_id = msg.toolCallId;
      }
      if (msg.name) {
        base.name = msg.name;
      }
      return base;
    });
  }
}
