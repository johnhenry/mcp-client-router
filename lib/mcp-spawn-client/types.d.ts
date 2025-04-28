/**
 * Type definitions for mcp-spawn-client
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Spawn a client connected to the server using in-memory transports.
 * @param server - The server to connect to
 * @param args - Arguments to pass to the client constructor
 * @returns A connected client instance
 */
export function spawnClient(
  server: McpServer, 
  ...args: any[]
): Promise<Client>;
