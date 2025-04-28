# MCP Create Express App

A utility module for creating Express applications with Model Context Protocol (MCP) support.

## Installation

```bash
npm install mcp-create-express-app express
```

## Usage

### Stateless Mode

```javascript
import express from "express";
import createExpressApp from "mcp-create-express-app";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Create an MCP server
const server = new McpServer({
  name: "my-server",
  version: "1.0.0",
});

// Define tools, prompts, and resources
server.tool("greet", { name: "string" }, async ({ name }) => {
  return { content: [{ type: "text", text: `Hello, ${name}!` }] };
});

const app = await createExpressApp(server);

// Start the Express server
const port = 3000;
app.listen(port, () => {
  console.log(`MCP server available at http://localhost:${port}${mcpPath}`);
});
```

### Stateful Mode

```javascript
import express from "express";
import { createStateful } from "mcp-client-router/create-express-app";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Create an Express app
const app = express();

// Create an MCP server
const server = new McpServer({
  name: "my-server",
  version: "1.0.0",
});

// Define tools, prompts, and resources
server.tool("greet", { name: "string" }, async ({ name }) => {
  return { content: [{ type: "text", text: `Hello, ${name}!` }] };
});

// Mount the MCP server to the Express app with stateful behavior
const mcpPath = "/mcp";
createStateful(app, server, {
  path: mcpPath,
  sessionTimeout: 300000, // 5 minutes
});

// Start the Express server
const port = 3000;
app.listen(port, () => {
  console.log(
    `Stateful MCP server available at http://localhost:${port}${mcpPath}`
  );
});
```

## API Reference

### `createStateless`

```javascript
function createStateless(app, server, options)
```

Creates a stateless HTTP endpoint for an MCP server in an Express app. Each request is treated as independent.

#### Parameters

- `app` (Express app): The Express application
- `server` (McpServer): The MCP server to expose
- `options` (object): Configuration options
  - `path` (string): The URL path to mount the MCP server (default: '/mcp')
  - `corsOptions` (object): CORS configuration options

### `createStateful`

```javascript
function createStateful(app, server, options)
```

Creates a stateful HTTP endpoint for an MCP server in an Express app. Maintains session state between requests.

#### Parameters

- `app` (Express app): The Express application
- `server` (McpServer): The MCP server to expose
- `options` (object): Configuration options
  - `path` (string): The URL path to mount the MCP server (default: '/mcp')
  - `sessionTimeout` (number): Session timeout in milliseconds (default: 30 minutes)
  - `corsOptions` (object): CORS configuration options

## License

ISC
