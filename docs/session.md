# Session

本页介绍 Blade Agent SDK 的核心 Session API。

## 创建会话

```ts
import { createSession } from '@blade-ai/agent-sdk';

const session = await createSession({
  provider: { type: 'openai-compatible', apiKey: process.env.API_KEY },
  model: 'gpt-4o-mini',
});
```

## SessionOptions

```ts
import type { SessionOptions } from '@blade-ai/agent-sdk';

const options: SessionOptions = {
  provider: { type: 'openai-compatible', apiKey: process.env.API_KEY },
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a careful coding agent.',
  maxTurns: 12,
  allowedTools: ['Read', 'Edit', 'Write', 'Bash'],
  disallowedTools: ['KillShell'],
  defaultContext: {
    capabilities: {
      filesystem: {
        roots: ['/workspace/project'],
        cwd: '/workspace/project',
      },
    },
    environment: { CI: '1' },
  },
};
```

常用字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `provider` | `ProviderConfig` | 模型提供方配置 |
| `model` | `string` | 模型 ID |
| `systemPrompt` | `string` | 会话级系统提示 |
| `maxTurns` | `number` | 最大轮次 |
| `allowedTools` | `string[]` | 仅允许指定工具 |
| `disallowedTools` | `string[]` | 禁用指定工具 |
| `tools` | `ToolDefinition[]` | 追加自定义工具 |
| `mcpServers` | `Record<string, McpServerConfig \| SdkMcpServerHandle>` | MCP server 配置 |
| `permissionMode` | `PermissionMode` | 默认权限模式 |
| `canUseTool` | `CanUseTool` | 运行时权限决策 |
| `hooks` | `Partial<Record<SessionHookEvent, HookCallback[]>>` | 回调式 hooks |
| `cwd` | `string` | 工作目录 |
| `env` | `Record<string, string>` | 传递给工具执行的环境变量 |
| `logger` | `AgentLogger` | 结构化日志接入 |
| `outputFormat` | `OutputFormat` | JSON Schema 结构化输出 |
| `sandbox` | `SandboxSettings` | 命令执行沙箱配置 |
| `agents` | `Record<string, AgentDefinition>` | 命名子代理定义 |

## send / stream

`send()` 只提交消息，`stream()` 负责消费这次消息对应的 Agent 输出。

```ts
await session.send('分析最近两次提交对会话持久化的影响');

for await (const msg of session.stream({ includeThinking: true })) {
  switch (msg.type) {
    case 'turn_start':
      console.log(`turn ${msg.turn}`);
      break;
    case 'content':
      process.stdout.write(msg.delta);
      break;
    case 'tool_use':
      console.log(`[tool] ${msg.name}`);
      break;
    case 'tool_result':
      console.log(`[tool-result] ${msg.name}`);
      break;
    case 'usage':
      console.log(msg.usage);
      break;
    case 'result':
      console.log(msg.subtype, msg.content);
      break;
  }
}
```

约束：

- 调 `stream()` 之前必须先调 `send()`
- 一条 pending message 只能被消费一次
- 如果上一条消息还没 `stream()` 完成，不能再次 `send()`

## prompt

`prompt()` 适合一次性请求，不保留长期会话对象。

```ts
import { prompt } from '@blade-ai/agent-sdk';

const result = await prompt('给我一份这个仓库的公开 API 摘要', {
  provider: { type: 'openai-compatible', apiKey: process.env.API_KEY },
  model: 'gpt-4o-mini',
});

console.log(result.result);
console.log(result.toolCalls);
console.log(result.turnsCount);
```

## 恢复和分叉

### 恢复

```ts
import { resumeSession } from '@blade-ai/agent-sdk';

const session = await resumeSession({
  sessionId: 'existing-session-id',
  provider: { type: 'openai-compatible', apiKey: process.env.API_KEY },
  model: 'gpt-4o-mini',
});
```

### 分叉

```ts
import { forkSession } from '@blade-ai/agent-sdk';

const forked = await forkSession({
  sessionId: 'existing-session-id',
  messageId: 'msg-123',
  provider: { type: 'openai-compatible', apiKey: process.env.API_KEY },
  model: 'gpt-4o-mini',
});
```

也可以从实例调用：

```ts
const forked = await session.fork({ messageId: 'msg-123' });
```

## Session 方法

### 生命周期

- `close()`：关闭会话并释放资源
- `abort()`：中止当前执行

### 运行时控制

- `setPermissionMode(mode)`：切换权限模式
- `setModel(model)`：切换后续回合的模型
- `setMaxTurns(maxTurns)`：更新最大轮次
- `supportedModels()`：列出当前 provider 支持的模型

### MCP

- `mcpServerStatus()`
- `mcpConnect(serverName)`
- `mcpDisconnect(serverName)`
- `mcpReconnect(serverName)`
- `mcpListTools()`

## StreamMessage

`stream()` 产生的事件类型：

- `turn_start`
- `turn_end`
- `content`
- `thinking`
- `tool_use`
- `tool_result`
- `usage`
- `result`
- `error`

## 命名子代理

`agents` 用于定义命名子代理，供内置任务类工具或运行时使用：

```ts
import type { AgentDefinition } from '@blade-ai/agent-sdk';

const agents: Record<string, AgentDefinition> = {
  research: {
    name: 'research',
    description: 'Investigate repository structure and summarize findings',
    allowedTools: ['Read', 'Glob', 'Grep'],
    model: 'gpt-4o-mini',
  },
};
```

## 自动清理

如果运行环境支持 `using` / `AsyncDisposable`，可以这样写：

```ts
await using session = await createSession({
  provider: { type: 'openai-compatible', apiKey: process.env.API_KEY },
  model: 'gpt-4o-mini',
});
```
