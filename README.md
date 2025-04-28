# MCP Client Router

The MCP Client Router is a transport interface for aggregating multiple Model Context Protocol (MCP) clients into a single unified interface. It allows you to seamlessly interact with multiple MCP servers through a single client interface.

## Features

- Route calls to the appropriate MCP client based on prefixed names
- Aggregate tools, prompts, and resources from multiple clients
- Prefix/suffix naming convention to route requests to the correct client
- Implementation of the MCP Transport interface for seamless integration
- Support for both HTTP and stdio-based MCP servers

## Installation

```bash
npm install mcp-client-router
```

## Usage

### Basic Usage

```javascript
import { ClientRouter } from 'mcp-client-router';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Create individual clients
const client1 = new Client({ name: 'client1', version: '1.0.0' });
const client2 = new Client({ name: 'client2', version: '1.0.0' });

// Connect them to their respective transports
await client1.connect(new StdioClientTransport({
  command: 'node',
  args: ['server1.js']
}));

await client2.connect(new StdioClientTransport({
  command: 'node',
  args: ['server2.js']
}));

// Create a router with the clients
const router = new ClientRouter([client1, client2]);

// Now you can use the router as a unified client
const allTools = await router.listTools();
// Tools will be prefixed with client names, e.g., "client1__toolName"

// To call a specific tool
const result = await router.callTool({
  name: 'client1__toolName',
  arguments: { /* args */ }
});
```

### Creating from Configuration Object

```javascript
import { fromObject } from 'mcp-client-router';

const router = await fromObject({
  mcpServers: {
    client1: {
      command: 'node',
      args: ['server1.js']
    },
    client2: {
      url: 'http://localhost:3000/mcp'
    }
  }
});

// Now use the router as a unified client
```

### Connecting to a Server Transport

```javascript
import { ClientRouter } from 'mcp-client-router';
import { HTTPServerTransport } from '@modelcontextprotocol/sdk/server/http.js';

// Create router with clients
const router = new ClientRouter([/* clients */]);

// Connect to an HTTP server transport
const httpTransport = await router.connect(HTTPServerTransport, {
  port: 3000,
  path: '/mcp'
});

// The router now acts as an MCP server
```

## How It Works

The Client Router prefixes the names of tools, prompts, and resources with the client name followed by a double underscore (`__`). For example:

- A tool named `analyze` from client `client1` becomes `client1__analyze`
- A prompt named `greeting` from client `client2` becomes `client2__greeting`
- A resource with URI `docs/api.md` from client `client3` becomes `client3__docs/api.md`

When you call a prefixed tool/prompt/resource, the Client Router routes the call to the appropriate client.

## Submodules

This package includes several utility submodules:

- `mcp-declarative-server`: Create MCP servers declaratively
- `mcp-spawn-client`: Easily spawn clients connected to servers
- `mcp-spawn-express-app`: Create Express apps with MCP support

## API Reference

### `ClientRouter`

The main class that implements the MCP Transport interface.

```javascript
new ClientRouter(clients = [])
```

#### Methods

- `start()`: Starts processing messages on the transport
- `send(message, options)`: Sends a JSON-RPC message
- `close()`: Closes all client connections
- `connect(transportOrConstructor, options)`: Connects to a server transport

### `fromObject(obj, options)`

Creates a ClientRouter from a configuration object.

## License

ISC
