/**
 * Type definitions for mcp-create-express-app
 */

import { Application } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface createExpressOptions {
  /**
   * The path at which to expose the MCP server
   * @default '/mcp'
   */
  path?: string;

  /**
   * CORS configuration options
   */
  corsOptions?: {
    origin?:
      | string
      | string[]
      | boolean
      | ((
          origin: string,
          callback: (err: Error | null, allow?: boolean) => void
        ) => void);
    methods?: string | string[];
    allowedHeaders?: string | string[];
    exposedHeaders?: string | string[];
    credentials?: boolean;
    maxAge?: number;
    preflightContinue?: boolean;
    optionsSuccessStatus?: number;
  };
}

export interface createStatefulOptions extends createExpressOptions {
  /**
   * Session timeout in milliseconds
   * @default 1800000 (30 minutes)
   */
  sessionTimeout?: number;
}

/**
 * Creates a stateless HTTP endpoint for an MCP server in an Express app
 * @param app The Express application
 * @param server The MCP server to expose
 * @param options Configuration options
 */
export function createStateless(
  app: Application,
  server: McpServer,
  options?: createExpressOptions
): void;

/**
 * Creates a stateful HTTP endpoint for an MCP server in an Express app
 * @param app The Express application
 * @param server The MCP server to expose
 * @param options Configuration options
 */
export function createStateful(
  app: Application,
  server: McpServer,
  options?: createStatefulOptions
): void;

// Alias for createStateless
export const createExpressApp: typeof createStateless;
