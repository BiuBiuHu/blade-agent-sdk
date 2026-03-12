# MCP

Blade Agent SDK 支持把 MCP server 作为 Session 的一部分接入。

## 1. 在 Session 中连接外部 MCP server

```ts
import { createSession } from '@blade-ai/agent-sdk';

const session = await createSession({
  provider: { type: 'openai-compatible', apiKey: process.env.API_KEY },
  model: 'gpt-4o-mini',
  mcpServers: {
    filesystem: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@anthropic-ai/mcp-server-filesystem', '/workspace/project'],
    },
    github: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@anthropic-ai/mcp-server-github'],
      env: {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? '',
      },
    },
  },
});
```

## 2. 支持的 server 配置

`SessionOptions.mcpServers` 支持：

- stdio server
- SSE server
- HTTP server
- `SdkMcpServerHandle` in-process server

### stdio

```ts
{
  type: 'stdio',
  command: 'npx',
  args: ['-y', 'my-mcp-server'],
  env: { TOKEN: '...' },
}
```

### SSE

```ts
{
  type: 'sse',
  url: 'https://example.com/mcp/sse',
  headers: { Authorization: 'Bearer ...' },
}
```

### HTTP

```ts
{
  type: 'http',
  url: 'https://example.com/mcp',
  headers: { Authorization: 'Bearer ...' },
}
```

## 3. 查询和管理运行时状态

```ts
const status = await session.mcpServerStatus();
const tools = await session.mcpListTools();

await session.mcpConnect('filesystem');
await session.mcpDisconnect('filesystem');
await session.mcpReconnect('filesystem');
```

`mcpServerStatus()` 返回：

```ts
interface McpServerStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  toolCount: number;
  tools?: string[];
  connectedAt?: Date;
  error?: string;
}
```

`mcpListTools()` 返回：

```ts
interface McpToolInfo {
  name: string;
  description: string;
  serverName: string;
}
```

## 4. 定义 in-process MCP server

如果你不想启动额外进程，可以直接在当前应用内定义 MCP server。

```ts
import { createSdkMcpServer, tool } from '@blade-ai/agent-sdk';
import { z } from 'zod';

const greet = tool(
  'greet',
  'Greet a user by name',
  { name: z.string() },
  async ({ name }) => ({
    content: [{ type: 'text', text: `Hello, ${name}!` }],
  }),
);

const greetServer = await createSdkMcpServer({
  name: 'greetings',
  version: '1.0.0',
  tools: [greet],
});
```

然后把这个 handle 传给 `mcpServers`：

```ts
const session = await createSession({
  provider: { type: 'openai-compatible', apiKey: process.env.API_KEY },
  model: 'gpt-4o-mini',
  mcpServers: {
    greetings: greetServer,
  },
});
```

## 5. MCP tool authoring contract

### `tool()`

```ts
tool(
  name: string,
  description: string,
  schema: Record<string, z.ZodTypeAny>,
  handler: (params) => Promise<McpToolResponse>,
)
```

### `createSdkMcpServer()`

```ts
createSdkMcpServer({
  name: string,
  version: string,
  tools: SdkTool[],
})
```

## 6. JSON Schema 兼容

SDK 会把 MCP tool 的 `inputSchema` 转成内部参数 schema。常见的 object / enum / nullable / local `$ref` 都会处理；无法安全转换时，会降级成更宽松的记录类型，以保证 server 不因 schema 问题直接不可用。

## 7. 当前公开边界

MCP 在根导出里保留的是“接入 contract”，不再公开这些内部实现：

- `McpRegistry`
- `McpClient`
- `HealthMonitor`

如果你只是接入 SDK，通常不需要直接操作这些对象。
