import type { ToolCall } from '../../services/ChatServiceInterface.js';

export type FunctionToolCall = ToolCall & {
  type: 'function';
  function: { name: string; arguments: string };
};
