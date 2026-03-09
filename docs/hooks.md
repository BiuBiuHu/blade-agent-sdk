# Hooks

Blade Agent SDK 的 Hooks 是 callback-based 的运行时扩展点，配置在 `SessionOptions.hooks` 上。

```ts
import { createSession, HookEvent } from '@blade-ai/agent-sdk';

const session = await createSession({
  provider: { type: 'openai-compatible', apiKey: process.env.API_KEY },
  model: 'gpt-4o-mini',
  hooks: {
    [HookEvent.PreToolUse]: [
      async (input) => {
        if (input.toolName === 'Bash') {
          return { action: 'continue' };
        }
        return { action: 'continue' };
      },
    ],
  },
});
```

## 支持的事件

当前 `SessionOptions.hooks` 支持以下事件：

- `HookEvent.SessionStart`
- `HookEvent.SessionEnd`
- `HookEvent.UserPromptSubmit`
- `HookEvent.PermissionRequest`
- `HookEvent.PreToolUse`
- `HookEvent.PostToolUse`
- `HookEvent.PostToolUseFailure`
- `HookEvent.TaskCompleted`

注意：

- `HookEvent` 这个常量本身还包含一些内部/遗留事件
- 但 Session API 只保证上面这 8 个事件可通过 `SessionOptions.hooks` 使用

## Hook 输入

```ts
interface HookInput {
  event: HookEvent;
  sessionId: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  error?: Error;
  [key: string]: unknown;
}
```

不同事件会附带不同字段：

- `UserPromptSubmit`：包含用户输入相关信息
- `PermissionRequest`：包含权限检查输入
- `PreToolUse`：包含 `toolName`、`toolInput`
- `PostToolUse`：包含 `toolName`、`toolInput`、`toolOutput`
- `PostToolUseFailure`：包含 `error`

## Hook 输出

```ts
interface HookOutput {
  action: 'continue' | 'skip' | 'abort';
  modifiedInput?: unknown;
  modifiedOutput?: unknown;
  reason?: string;
}
```

约定：

- `continue`：继续执行
- `skip`：跳过当前阶段或当前处理
- `abort`：中止当前执行，并使用 `reason` 作为原因

`modifiedInput` 和 `modifiedOutput` 用于修改工具输入或输出。

## 常见场景

### 1. 拦截危险命令

```ts
hooks: {
  [HookEvent.PreToolUse]: [
    async (input) => {
      const raw = JSON.stringify(input.toolInput ?? {});
      if (input.toolName === 'Bash' && raw.includes('rm -rf')) {
        return { action: 'abort', reason: 'Dangerous command blocked' };
      }
      return { action: 'continue' };
    },
  ],
}
```

### 2. 自动修改工具输入

```ts
hooks: {
  [HookEvent.PreToolUse]: [
    async (input) => {
      if (input.toolName !== 'Write') {
        return { action: 'continue' };
      }

      return {
        action: 'continue',
        modifiedInput: {
          ...(input.toolInput as Record<string, unknown>),
          encoding: 'utf-8',
        },
      };
    },
  ],
}
```

### 3. 给工具输出打标记

```ts
hooks: {
  [HookEvent.PostToolUse]: [
    async (input) => ({
      action: 'continue',
      modifiedOutput: {
        ...(input.toolOutput as Record<string, unknown>),
        audited: true,
      },
    }),
  ],
}
```

### 4. 权限检查前预处理输入

```ts
hooks: {
  [HookEvent.PermissionRequest]: [
    async (input) => ({
      action: 'continue',
      modifiedInput: {
        ...(input.toolInput as Record<string, unknown>),
        requestedBy: 'hook',
      },
    }),
  ],
}
```

## 与 `canUseTool` 的关系

推荐分工：

- `hooks`：修改输入/输出、记录审计、补充上下文
- `canUseTool`：做最终权限决策

也就是说：

- 用 `PreToolUse` / `PermissionRequest` 做输入改写
- 用 `canUseTool` 返回 `allow` / `deny` / `ask`

## 错误处理建议

- hook 内抛异常会影响当前执行
- 对非关键逻辑，优先返回 `{ action: 'continue' }`
- 对明确的阻断场景，再返回 `{ action: 'abort', reason }`
