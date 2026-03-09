import type { PermissionMode } from '../../types/common.js';
import type { FunctionToolCall } from './types.js';

type ToolRegistryLike = {
  get(name: string): unknown;
};

export interface ToolExecutionPlan {
  mode: 'parallel' | 'serial';
  calls: FunctionToolCall[];
}

export function planToolExecution(
  calls: FunctionToolCall[],
  _registry: ToolRegistryLike,
  _permissionMode?: PermissionMode,
): ToolExecutionPlan {
  return {
    mode: 'parallel',
    calls,
  };
}
