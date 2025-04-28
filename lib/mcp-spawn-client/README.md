# MCP Spawn Client

A utility module for spawning Model Context Protocol (MCP) clients connected to servers using in-memory transports.

## Installation

```bash
npm install mcp-client-router
```

## Usage

```javascript
import { spawnClient } from 'mcp-client-router/spawn-client';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Create a server
const server = new McpServer({
  name: 'test-server',
  version: '1.0.0',
});

// Define tools, prompts, and resources
server.tool('greet', { name: 'string' }, async ({ name }) => {
  return { content: [{ type: 'text', text: `Hello, ${name}!` }] };
});

// Spawn a client connected to the server
const client = await spawnClient(server, { 
  name: 'test-client', 
  version: '1.0.0' 
});

// Use the client
const result = await client.callTool({
  name: 'greet',
  arguments: { name: 'World' }
});

console.log(result); // { content: [{ type: 'text', text: 'Hello, World!' }] }
```

## API Reference

### `spawnClient`

```javascript
async function spawnClient(server, ...clientArgs)
```

#### Parameters

- `server` (McpServer): The MCP server to connect to
- `...clientArgs`: Arguments to pass to the Client constructor

#### Returns

- Promise<Client>: A connected client instance

## How It Works

The `spawnClient` function:

1. Creates a pair of linked in-memory transports
2. Connects one transport to the server
3. Creates a new client with the provided args
4. Connects the client to the other transport
5. Returns the connected client

This allows for easy testing and development without needing to set up network transports.

## License

ISC
