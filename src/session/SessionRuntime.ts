import * as os from 'os';
import * as path from 'path';
import { ContextManager } from '../context/ContextManager.js';
import type { HookCallback, McpServerStatus, McpToolInfo, SessionOptions } from './types.js';
import { HookManager } from '../hooks/HookManager.js';
import { createLogger, LogCategory } from '../logging/Logger.js';
import { McpRegistry } from '../mcp/McpRegistry.js';
import type { SdkMcpServerHandle } from '../mcp/SdkMcpServer.js';
import { McpConnectionStatus } from '../mcp/types.js';
import { getCheckpointService } from '../checkpoint/index.js';
import { getSandboxService } from '../sandbox/SandboxService.js';
import { getBuiltinTools } from '../tools/builtin/index.js';
import { ExecutionPipeline } from '../tools/execution/ExecutionPipeline.js';
import { ToolRegistry } from '../tools/registry/ToolRegistry.js';
import { toolFromDefinition } from '../tools/core/createTool.js';
import type { Tool } from '../tools/types/index.js';
import type { AgentRuntimeDeps } from '../agent/Agent.js';
import type { BladeConfig, McpServerConfig, PermissionsConfig } from '../types/common.js';
import { PermissionMode } from '../types/common.js';
import type { HookEvent } from '../types/constants.js';

const logger = createLogger(LogCategory.AGENT);

function isSdkMcpServerHandle(
  config: McpServerConfig | SdkMcpServerHandle
): config is SdkMcpServerHandle {
  return 'createClientTransport' in config && 'server' in config;
}

function getToolDescription(tool: Tool): string {
  return typeof tool.description === 'string'
    ? tool.description
    : tool.description.short;
}

export class SessionRuntime {
  private readonly mcpRegistry = new McpRegistry();
  private readonly toolRegistry = new ToolRegistry();
  private readonly contextManager: ContextManager;
  private readonly executionPipeline: ExecutionPipeline;
  private readonly hookCallbacks: Partial<Record<HookEvent, HookCallback[]>>;
  private initialized = false;

  constructor(
    private readonly sessionId: string,
    private readonly options: SessionOptions,
    private readonly bladeConfig: BladeConfig,
    private readonly permissionMode: PermissionMode,
    private readonly workspaceRoot: string,
  ) {
    this.contextManager = new ContextManager({ projectPath: workspaceRoot });
    this.hookCallbacks = options.hooks || {};
    this.executionPipeline = this.createExecutionPipeline();
  }

  getAgentRuntimeDeps(): AgentRuntimeDeps {
    return {
      executionPipeline: this.executionPipeline,
      contextManager: this.contextManager,
      workspaceRoot: this.workspaceRoot,
      mcpRegistry: this.mcpRegistry,
      runtimeManaged: true,
    };
  }

  getBladeConfig(): BladeConfig {
    return this.bladeConfig;
  }

  getHookCallbacks(): Partial<Record<HookEvent, HookCallback[]>> {
    return this.hookCallbacks;
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.options.sandbox) {
      getSandboxService().configure(this.options.sandbox);
    }

    if (this.options.enableFileCheckpointing) {
      getCheckpointService().configure({ enabled: true });
    }

    await this.contextManager.initialize();
    this.initializeHooks();
    await this.registerBuiltinTools();
    this.registerCustomTools();
    await this.registerConfiguredMcpServers();

    this.initialized = true;
  }

  async close(): Promise<void> {
    await this.mcpRegistry.disconnectAll();
  }

  async mcpServerStatus(): Promise<McpServerStatus[]> {
    const statuses: McpServerStatus[] = [];
    for (const [name, serverInfo] of this.mcpRegistry.getAllServers()) {
      const statusMap: Record<McpConnectionStatus, McpServerStatus['status']> = {
        [McpConnectionStatus.CONNECTED]: 'connected',
        [McpConnectionStatus.DISCONNECTED]: 'disconnected',
        [McpConnectionStatus.CONNECTING]: 'connecting',
        [McpConnectionStatus.ERROR]: 'error',
      };
      statuses.push({
        name,
        status: statusMap[serverInfo.status],
        toolCount: serverInfo.tools.length,
        tools: serverInfo.tools.map((tool) => tool.name),
        connectedAt: serverInfo.connectedAt,
        error: serverInfo.lastError?.message,
      });
    }
    return statuses;
  }

  async mcpConnect(serverName: string): Promise<void> {
    await this.ensureServerRegistered(serverName);
    await this.mcpRegistry.connectServer(serverName);
    await this.refreshMcpTools([serverName]);
  }

  async mcpDisconnect(serverName: string): Promise<void> {
    await this.mcpRegistry.disconnectServer(serverName);
    await this.refreshMcpTools([serverName]);
  }

  async mcpReconnect(serverName: string): Promise<void> {
    await this.ensureServerRegistered(serverName);
    await this.mcpRegistry.reconnectServer(serverName);
    await this.refreshMcpTools([serverName]);
  }

  async mcpListTools(): Promise<McpToolInfo[]> {
    return this.toolRegistry.getMcpTools().map((tool) => ({
      name: tool.name,
      description: getToolDescription(tool),
      serverName: tool.tags.find((tag) => tag !== 'mcp' && tag !== 'external') || 'unknown',
    }));
  }

  private createExecutionPipeline(): ExecutionPipeline {
    const permissionConfig: PermissionsConfig = {
      allow: [],
      ask: [],
      deny: [],
      ...this.bladeConfig.permissions,
    };

    return new ExecutionPipeline(this.toolRegistry, {
      permissionConfig,
      permissionMode: this.permissionMode,
      maxHistorySize: 1000,
      canUseTool: this.options.canUseTool,
    });
  }

  private initializeHooks(): void {
    const hookManager = HookManager.getInstance();
    if (this.options.hooks && Object.keys(this.options.hooks).length > 0) {
      hookManager.enable();
    }
  }

  private async registerBuiltinTools(): Promise<void> {
    const builtinTools = await getBuiltinTools({
      sessionId: this.sessionId,
      configDir: path.join(os.homedir(), '.blade'),
      mcpRegistry: this.mcpRegistry,
      includeMcpProtocolTools: false,
    });
    this.registerTools(builtinTools);
  }

  private registerCustomTools(): void {
    if (!this.options.tools || this.options.tools.length === 0) {
      return;
    }
    const tools = this.options.tools.map((tool) => toolFromDefinition(tool));
    this.registerTools(tools);
  }

  private async registerConfiguredMcpServers(): Promise<void> {
    if (!this.options.mcpServers) {
      return;
    }

    for (const [name, config] of Object.entries(this.options.mcpServers)) {
      if (isSdkMcpServerHandle(config)) {
        await this.mcpRegistry.registerInProcessServer(name, config);
        continue;
      }
      if (config.disabled) {
        continue;
      }
      try {
        await this.mcpRegistry.registerServer(name, config);
      } catch (error) {
        logger.warn(`[SessionRuntime] Failed to register MCP server ${name}:`, error);
      }
    }

    await this.refreshMcpTools(Object.keys(this.options.mcpServers));
  }

  private async ensureServerRegistered(serverName: string): Promise<void> {
    const serverInfo = this.mcpRegistry.getServerStatus(serverName);
    if (serverInfo) {
      return;
    }

    const config = this.options.mcpServers?.[serverName];
    if (!config) {
      throw new Error(`MCP server "${serverName}" not found in configuration`);
    }

    if (isSdkMcpServerHandle(config)) {
      await this.mcpRegistry.registerInProcessServer(serverName, config);
      return;
    }

    await this.mcpRegistry.registerServer(serverName, config);
  }

  private async refreshMcpTools(serverNames: string[]): Promise<void> {
    for (const serverName of serverNames) {
      this.toolRegistry.removeMcpTools(serverName);
    }

    const availableTools = await this.mcpRegistry.getAvailableToolsByServerNames(serverNames);
    for (const tool of this.filterTools(availableTools)) {
      this.toolRegistry.registerMcpTool(tool);
    }
  }

  private registerTools(tools: Tool<any>[]): void {
    const filteredTools = this.filterTools(tools);
    if (filteredTools.length === 0) {
      return;
    }
    this.toolRegistry.registerAll(filteredTools);
  }

  private filterTools(tools: Tool<any>[]): Tool<any>[] {
    const allowedTools = this.options.allowedTools;
    const disallowedTools = new Set(this.options.disallowedTools || []);

    return tools.filter((tool) => {
      if (allowedTools && allowedTools.length > 0 && !allowedTools.includes(tool.name)) {
        return false;
      }
      return !disallowedTools.has(tool.name);
    });
  }
}
