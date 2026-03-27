# 常见模式

## 多轮对话

最基本的多轮对话——依次发送多条消息，每条消息都能引用之前的上下文：

```ts
import { createSession } from '@blade-ai/agent-sdk';

const session = await createSession({
  provider: { type: 'openai', apiKey: process.env.OPENAI_API_KEY! },
  model: 'gpt-4o',
});

const questions = [
  '分析 src/index.ts 的结构',
  '找出其中的潜在问题',
  '修复你发现的第一个问题',
];

for (const question of questions) {
  await session.send(question);
  for await (const event of session.stream()) {
    if (event.type === 'content') {
      process.stdout.write(event.delta);
    }
  }
  console.log('\n---\n');
}

session.close();
```

### 带流式输出的交互式对话

下面是一个更完整的示例，模拟一个交互式 CLI Agent：逐字流式输出、显示工具调用过程、统计 Token 用量，并支持用户持续输入：

```ts
import { createSession } from '@blade-ai/agent-sdk';
import * as readline from 'node:readline';

const session = await createSession({
  provider: { type: 'openai', apiKey: process.env.OPENAI_API_KEY! },
  model: 'gpt-4o',
  systemPrompt: '你是一个代码助手，帮助用户分析和修改项目代码。',
  maxTurns: 30,
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (prompt: string) => new Promise<string>((resolve) => rl.question(prompt, resolve));

let round = 0;

while (true) {
  const input = await ask(`\n[${++round}] 你> `);
  if (input === 'exit' || input === 'quit') break;

  await session.send(input);

  let tokenCount = 0;
  let toolCalls = 0;

  for await (const msg of session.stream()) {
    switch (msg.type) {
      case 'turn_start':
        break;

      case 'content':
        process.stdout.write(msg.delta);
        break;

      case 'tool_use':
        toolCalls++;
        console.log(`\n  ⚙️  调用 ${msg.name}...`);
        break;

      case 'tool_result':
        console.log(`  ${msg.isError ? '❌' : '✅'} ${msg.name} 完成`);
        break;

      case 'usage':
        tokenCount = msg.usage.totalTokens;
        break;

      case 'result':
        if (msg.subtype === 'error') {
          console.error(`\n❗ 错误: ${msg.error}`);
        }
        break;

      case 'error':
        console.error(`\n❗ 系统错误: ${msg.message}`);
        break;
    }
  }

  console.log(`\n  📊 本轮: ${tokenCount} tokens, ${toolCalls} 次工具调用`);
}

rl.close();
session.close();
console.log('会话已结束');
```

运行效果：

```
[1] 你> 看看 src 目录下有哪些文件
  ⚙️  调用 Bash...
  ✅ Bash 完成
src 目录下有以下文件：
- index.ts
- utils.ts
- config.ts
...
  📊 本轮: 1234 tokens, 1 次工具调用

[2] 你> 分析 index.ts 的导出结构
  ⚙️  调用 Read...
  ✅ Read 完成
index.ts 导出了 15 个函数和 22 个类型...
  📊 本轮: 2456 tokens, 1 次工具调用

[3] 你> exit
会话已结束
```

## 带取消的长任务

```ts
const controller = new AbortController();

setTimeout(() => controller.abort(), 60_000);

await session.send('重构整个 src 目录', { signal: controller.signal });

try {
  for await (const event of session.stream()) {
    if (event.type === 'content') {
      process.stdout.write(event.delta);
    }
  }
} catch (err) {
  if (controller.signal.aborted) {
    console.log('\n任务已超时取消');
  }
}
```

## 结构化输出

通过 `OutputFormat` 强制 Agent 以 JSON Schema 格式输出：

```ts
import type { OutputFormat } from '@blade-ai/agent-sdk';

const outputFormat: OutputFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'code_review',
    description: '代码审查结果',
    schema: {
      type: 'object',
      properties: {
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              severity: { type: 'string', enum: ['error', 'warning', 'info'] },
              file: { type: 'string' },
              line: { type: 'number' },
              message: { type: 'string' },
            },
            required: ['severity', 'file', 'message'],
          },
        },
        summary: { type: 'string' },
      },
      required: ['issues', 'summary'],
    },
    strict: true,
  },
};

const session = await createSession({
  provider: { type: 'openai', apiKey: process.env.OPENAI_API_KEY! },
  model: 'gpt-4o',
  outputFormat,
});
```

## AsyncDisposable 自动清理

```ts
{
  await using session = await createSession({
    provider: { type: 'openai', apiKey: process.env.OPENAI_API_KEY! },
    model: 'gpt-4o',
  });

  await session.send('Hello');
  for await (const event of session.stream()) { /* ... */ }
  // session 会在作用域结束时自动关闭
}
```

## 完整事件处理

```ts
let totalTokens = 0;

for await (const msg of session.stream({ includeThinking: true })) {
  switch (msg.type) {
    case 'turn_start':
      console.log(`\n--- 第 ${msg.turn} 轮 ---`);
      break;
    case 'thinking':
      process.stderr.write(`[思考] ${msg.delta}`);
      break;
    case 'content':
      process.stdout.write(msg.delta);
      break;
    case 'tool_use':
      console.log(`\n🔧 ${msg.name}(${JSON.stringify(msg.input)})`);
      break;
    case 'tool_result':
      console.log(`   → ${msg.isError ? '❌' : '✅'} ${msg.name}`);
      break;
    case 'usage':
      totalTokens = msg.usage.totalTokens;
      break;
    case 'result':
      if (msg.subtype === 'error') {
        console.error(`\n错误: ${msg.error}`);
      }
      break;
    case 'error':
      console.error(`\n系统错误: ${msg.message}`);
      break;
  }
}

console.log(`\n总 Token: ${totalTokens}`);
```
