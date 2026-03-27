# 子 Agent

Session 支持配置子 Agent，用于任务分解和并行执行。

## 内置子 Agent

SDK 内置 3 种子 Agent：

| 名称 | 用途 |
|------|------|
| general-purpose | 通用型，处理各类子任务 |
| Explore | 探索型，专注于代码搜索和分析 |
| Plan | 规划型，用于制定执行计划 |

## 自定义子 Agent

```ts
import type { AgentDefinition } from '@blade-ai/agent-sdk';

const session = await createSession({
  provider: { type: 'openai', apiKey: process.env.OPENAI_API_KEY! },
  model: 'gpt-4o',
  agents: {
    'code-reviewer': {
      name: 'Code Reviewer',
      description: '专门负责代码审查的 Agent',
      systemPrompt: '你是一位严格的代码审查专家，关注安全性和性能。',
      allowedTools: ['Read', 'Glob', 'Grep'],
      model: 'gpt-4o',
    },
    'test-writer': {
      name: 'Test Writer',
      description: '专门负责编写测试的 Agent',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
    },
  },
});
```

## AgentDefinition

```ts
interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt?: string;
  allowedTools?: string[];
  model?: string;
}
```

| 字段 | 说明 |
|------|------|
| `name` | 子 Agent 显示名称 |
| `description` | 描述，LLM 根据此决定何时调用 |
| `systemPrompt` | 子 Agent 专属的系统提示词 |
| `allowedTools` | 限制可用工具范围 |
| `model` | 使用不同模型（可选，默认继承主 Session） |
