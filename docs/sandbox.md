# Sandbox

Blade Agent SDK 通过 `SessionOptions.sandbox` 控制命令执行沙箱。

## 基本用法

```ts
import { createSession } from '@blade-ai/agent-sdk';

const session = await createSession({
  provider: { type: 'openai-compatible', apiKey: process.env.API_KEY },
  model: 'gpt-4o-mini',
  sandbox: {
    enabled: true,
    autoAllowBashIfSandboxed: true,
  },
});
```

## `SandboxSettings`

```ts
interface SandboxSettings {
  enabled?: boolean;
  autoAllowBashIfSandboxed?: boolean;
  excludedCommands?: string[];
  allowUnsandboxedCommands?: boolean;
  network?: {
    allowLocalBinding?: boolean;
    allowUnixSockets?: string[];
    allowAllUnixSockets?: boolean;
    httpProxyPort?: number;
    socksProxyPort?: number;
  };
  ignoreViolations?: {
    file?: string[];
    network?: string[];
  };
  enableWeakerNestedSandbox?: boolean;
}
```

## 常见配置

### 开启沙箱并自动批准沙箱内 Bash

```ts
sandbox: {
  enabled: true,
  autoAllowBashIfSandboxed: true,
}
```

### 排除特定命令

```ts
sandbox: {
  enabled: true,
  excludedCommands: ['sudo'],
}
```

### 允许本地端口绑定

```ts
sandbox: {
  enabled: true,
  network: {
    allowLocalBinding: true,
  },
}
```

### 允许指定 Unix socket

```ts
sandbox: {
  enabled: true,
  network: {
    allowUnixSockets: ['/var/run/docker.sock'],
  },
}
```

### 忽略特定违规

```ts
sandbox: {
  enabled: true,
  ignoreViolations: {
    file: ['/tmp/*'],
    network: ['localhost:*'],
  },
}
```

## 适用场景

- 在本地 coding agent 场景中约束 Bash 执行
- 限制文件系统和网络访问
- 让一部分命令在沙箱内自动通过，一部分命令继续走权限询问

## 当前公开边界

Sandbox 在根导出里只保留 `SandboxSettings` 这个配置 contract。

不再建议依赖这些内部实现对象：

- `SandboxService`
- `SandboxExecutor`
- `getSandboxService()`
- `getSandboxExecutor()`
