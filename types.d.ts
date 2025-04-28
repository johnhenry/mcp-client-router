/**
 * Type definitions for mcp-client-router
 */

import { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * Client info object for identifying clients
 */
export interface ClientInfo {
  name: string;
  version: string;
}

/**
 * MCP Client that includes ClientInfo for identification
 */
export interface MCPClient {
  _clientInfo: ClientInfo;
  transport?: Transport;
  callTool: (options: { name: string; arguments: any }) => Promise<any>;
  listTools: () => Promise<{ tools: Array<{ name: string; description: string }> }>;
  listPrompts: () => Promise<{ prompts: Array<{ name: string; description: string }> }>;
  getPrompt: (options: { name: string; arguments: any }) => Promise<any>;
  listResources: () => Promise<{ resources: Array<{ uri: string; [key: string]: any }> }>;
  readResource: (options: { uri: string }) => Promise<any>;
  connect: (transport: Transport) => Promise<Transport>;
  close: () => Promise<void>;
}

/**
 * MCPServer configuration for the fromObject factory
 */
export interface MCPServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  options?: any;
  enabled?: boolean;
}

/**
 * Configuration object for ClientRouter.fromObject
 */
export interface ClientRouterConfig {
  mcpServers?: Record<string, MCPServerConfig>;
}

/**
 * ClientRouter class that implements the Transport interface
 */
export class ClientRouter implements Transport {
  constructor(clients?: MCPClient[]);
  
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  sessionId?: string;
  
  start(): Promise<void>;
  send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void>;
  close(): Promise<void>;
  connect(transportOrConstructor: Transport | Function, options?: any): Promise<Transport>;
}

/**
 * Creates a ClientRouter from a configuration object
 */
export function fromObject(obj: ClientRouterConfig, options?: any): Promise<ClientRouter>;
