/**
 * Type definitions for mcp-declarative-server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type ToolHandler = (params: any) => Promise<any>;
export type PromptHandler = (params: any) => Promise<any>;
export type ResourceHandler = () => Promise<any>;

export type ToolDefinition = [
  name: string,
  paramSchema: Record<string, any>,
  handler: ToolHandler,
  description?: string
];

export type PromptDefinition = [
  name: string,
  paramSchema: Record<string, any>,
  handler: PromptHandler,
  description?: string
];

export type ResourceDefinition = [uri: string, handler: ResourceHandler];

export interface DeclarativeMCPServerOptions {
  name: string;
  version: string;
  tools: ToolDefinition[];
  prompts: PromptDefinition[];
  resources: ResourceDefinition[];
}

/**
 * DeclarativeMCPServer is a class that extends the McpServer class.
 * It allows you to create a server with tools, prompts, and resources
 * in a declarative way.
 */
export class DeclarativeMCPServer extends McpServer {
  constructor(options: DeclarativeMCPServerOptions);
}
