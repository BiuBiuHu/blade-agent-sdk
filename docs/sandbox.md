# 沙箱安全

沙箱（Sandbox）在操作系统层面限制 Agent 的命令执行能力，防止意外的文件删除、网络访问等危险操作。它与权限系统互补——权限控制「是否询问」，沙箱控制「能做什么」。

## 快速开始

```ts
import { createSession } from '@blade-ai/agent-sdk';

const session = await createSession({
  provider: { type: 'openai', apiKey: process.env.OPENAI_API_KEY },
  model: 'gpt-4o',
  sandbox: {
    enabled: true,
    autoAllowBashIfSandboxed: true,
  },
});
```

::: tip
`enabled: true` + `autoAllowBashIfSandboxed: true` 是本地开发推荐配置：命令在沙箱内执行（安全），同时不需要每次确认（便捷）。
:::

## SandboxSettings 完整参考

```ts
interface SandboxSettings {
  enabled?: boolean;
  autoAllowBashIfSandboxed?: boolean;
  excludedCommands?: string[];
  allowUnsandboxedCommands?: boolean;
  network?: NetworkSandboxSettings;
  ignoreViolations?: SandboxIgnoreViolations;
  enableWeakerNestedSandbox?: boolean;
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 开启沙箱 |
| `autoAllowBashIfSandboxed` | `boolean` | `false` | 沙箱内的 Bash 命令自动批准（不弹权限确认） |
| `excludedCommands` | `string[]` | `[]` | 排除在沙箱外执行的命令 |
| `allowUnsandboxedCommands` | `boolean` | `false` | 当沙箱不可用时，是否允许命令无沙箱执行 |
| `network` | `NetworkSandboxSettings` | — | 网络访问策略 |
| `ignoreViolations` | `SandboxIgnoreViolations` | — | 忽略特定违规 |
| `enableWeakerNestedSandbox` | `boolean` | `false` | 在已有沙箱内允许较弱的嵌套沙箱 |

## 网络配置

```ts
interface NetworkSandboxSettings {
  allowLocalBinding?: boolean;
  allowUnixSockets?: string[];
  allowAllUnixSockets?: boolean;
  httpProxyPort?: number;
  socksProxyPort?: number;
}
```

| 字段 | 说明 | 典型场景 |
|------|------|----------|
| `allowLocalBinding` | 允许绑定本地端口 | 启动开发服务器（vite、next dev） |
| `allowUnixSockets` | 允许访问指定 Unix Socket | Docker (`/var/run/docker.sock`) |
| `allowAllUnixSockets` | 允许所有 Unix Socket | 复杂 IPC 环境 |
| `httpProxyPort` | HTTP 代理端口 | 网络代理转发 |
| `socksProxyPort` | SOCKS 代理端口 | SOCKS 代理转发 |

## 违规忽略

当某些文件访问或网络连接会触发沙箱违规但属于预期行为时，可以配置忽略：

```ts
interface SandboxIgnoreViolations {
  file?: string[];     // glob 模式
  network?: string[];  // 主机:端口 模式
}
```

```ts
sandbox: {
  enabled: true,
  ignoreViolations: {
    file: ['/tmp/**', '/var/cache/**'],
    network: ['localhost:*', '127.0.0.1:3000'],
  },
}
```

## 沙箱 vs 权限

| 维度 | 沙箱（Sandbox） | 权限（Permission） |
|------|-----------------|---------------------|
| 层级 | 操作系统级 | 应用逻辑级 |
| 作用 | 限制命令**能做什么** | 控制命令**是否询问** |
| 配置项 | `sandbox` | `permissionMode` / `canUseTool` |
| 绕过方式 | 无法绕过（OS 强制） | 可通过 `yolo` 跳过 |

**组合配置对比：**

| 沙箱 | 权限模式 | 效果 |
|------|----------|------|
| ✅ enabled + autoAllow | `default` | 命令安全执行，无需确认（推荐开发） |
| ✅ enabled | `default` | 命令安全执行，每次确认 |
| ❌ disabled | `yolo` | 无沙箱无确认（危险） |
| ❌ disabled | `default` | 无沙箱，每次确认 |

::: danger
不建议同时关闭沙箱和使用 `yolo` 权限模式，这意味着 Agent 可以不受限制地执行任何命令。
:::

## 常见配置场景

### 本地开发（推荐）

```ts
sandbox: {
  enabled: true,
  autoAllowBashIfSandboxed: true,
  network: {
    allowLocalBinding: true,  // 允许 vite/next 绑定端口
  },
}
```

### Docker 工作流

```ts
sandbox: {
  enabled: true,
  autoAllowBashIfSandboxed: true,
  network: {
    allowUnixSockets: ['/var/run/docker.sock'],
  },
}
```

### CI/CD 严格模式

```ts
sandbox: {
  enabled: true,
  // 不自动批准，每个命令都需要权限检查
  autoAllowBashIfSandboxed: false,
}
```

### Web 爬虫/网络访问

```ts
sandbox: {
  enabled: true,
  autoAllowBashIfSandboxed: true,
  ignoreViolations: {
    network: ['*.example.com:443'],  // 允许特定域名
  },
}
```

### 不使用沙箱

当你在已有的安全环境（如容器内）运行，或沙箱与你的工作流不兼容时：

```ts
sandbox: {
  enabled: false,
}
```

## 排错指南

### 命令被意外阻止

**症状：** Bash 工具报告命令被沙箱阻止。

**解决：**
1. 检查是否启用了 `autoAllowBashIfSandboxed`
2. 查看是否需要将命令加入 `excludedCommands`
3. 检查 `ignoreViolations` 是否需要添加文件/网络规则

### 网络访问被拒绝

**症状：** `curl`、`wget` 等命令无法访问外部网络。

**解决：**
```ts
sandbox: {
  enabled: true,
  ignoreViolations: {
    network: ['target-host.com:443'],
  },
}
```

### Docker 命令失败

**症状：** `docker` 命令无法连接到 Docker daemon。

**解决：**
```ts
sandbox: {
  enabled: true,
  network: {
    allowUnixSockets: ['/var/run/docker.sock'],
  },
}
```

### 端口绑定失败

**症状：** 开发服务器无法启动，端口绑定被拒绝。

**解决：**
```ts
sandbox: {
  enabled: true,
  network: {
    allowLocalBinding: true,
  },
}
```
