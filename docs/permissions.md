# 权限控制

SDK 提供多层权限机制，控制 Agent 的工具执行行为。

## PermissionMode

4 种内置权限模式：

| 模式 | 值 | 说明 |
|------|------|------|
| 默认 | `'default'` | 写入和执行类工具需要用户确认 |
| 自动编辑 | `'autoEdit'` | 文件编辑自动通过，命令执行仍需确认 |
| YOLO | `'yolo'` | 所有工具自动通过 |
| 计划模式 | `'plan'` | 只允许只读工具 |

```ts
import { PermissionMode } from '@blade-ai/agent-sdk';

const session = await createSession({
  provider: { type: 'openai', apiKey: process.env.OPENAI_API_KEY! },
  model: 'gpt-4o',
  permissionMode: PermissionMode.AUTO_EDIT,
});

// 运行时切换
session.setPermissionMode(PermissionMode.YOLO);
```

::: warning
`yolo` 模式会跳过所有权限确认，仅建议在沙箱环境或完全信任的场景中使用。
:::

## 自定义权限回调

通过 `canUseTool` 实现完全自定义的权限逻辑：

```ts
import type { CanUseTool } from '@blade-ai/agent-sdk';

const canUseTool: CanUseTool = async (toolName, input, options) => {
  // options.toolKind: 'readonly' | 'write' | 'execute'
  // options.affectedPaths: string[]
  // options.signal: AbortSignal

  if (toolName === 'Bash' && String(input.command).includes('rm -rf')) {
    return { behavior: 'deny', message: '禁止执行危险的删除命令' };
  }

  if (options.toolKind === 'readonly') {
    return { behavior: 'allow' };
  }

  return { behavior: 'ask' };
};

const session = await createSession({
  provider: { type: 'openai', apiKey: process.env.OPENAI_API_KEY! },
  model: 'gpt-4o',
  canUseTool,
});
```

## PermissionResult

```ts
type PermissionResult =
  // 允许执行（可选修改输入）
  | { behavior: 'allow'; updatedInput?: Record<string, unknown>; updatedPermissions?: PermissionUpdate[] }
  // 拒绝执行
  | { behavior: 'deny'; message: string; interrupt?: boolean }
  // 交给内置权限系统决定
  | { behavior: 'ask' };
```

## CanUseToolOptions

```ts
interface CanUseToolOptions {
  signal: AbortSignal;
  toolKind: 'readonly' | 'write' | 'execute';
  affectedPaths: string[];
}
```

## 权限与沙箱的关系

权限控制「是否询问」，沙箱控制「能做什么」。两者独立工作，可以组合使用：

| 权限模式 | 沙箱 | 效果 |
|----------|------|------|
| `default` | 开启 | 需要确认 + 受沙箱限制 |
| `autoEdit` | 开启 | 文件操作自动通过 + 受沙箱限制 |
| `yolo` | 开启 | 自动通过 + 受沙箱限制（推荐开发模式） |
| `yolo` | 关闭 | 自动通过 + 无限制（危险） |

详见 [沙箱安全](./sandbox)。
