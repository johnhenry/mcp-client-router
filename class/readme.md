# MCP Multiclient

A drop-in replacement for the standard MCP Client that can connect to multiple MCP servers simultaneously.

## Overview

MCP Multiclient extends the functionality of the standard MCP Client by allowing connections to multiple MCP servers at once. It provides the same interface as the standard client, making it a seamless replacement in existing projects.

The key features include:
- Connect to multiple MCP servers (both HTTP and stdio-based)
- Aggregate tools, prompts, and resources from all connected servers
- Intelligently route requests to the appropriate server
- Option to specify which server to use for any operation
- Consistent error handling and logging

## Installation

```bash
npm install @modelcontextprotocol/multiclient
```

## Usage

### Basic Example

```javascript
import { MCPMulticlient } from '@modelcontextprotocol/multiclient';

// Create a new multiclient
const client = new MCPMulticlient({
  name: "MyClient",
  version: "1.0.0",
  verbose: true
});

// Connect to multiple servers
await client.connect("./path/to/mcp-server.js", { serverName: "server1" });
await client.connect("http://localhost:3000/mcp", { serverName: "server2" });

// List all available tools from all servers
const { tools } = await client.listTools();
console.log("Available tools:", tools);

// List tools from a specific server
const { tools: server1Tools } = await client.listTools({}, "server1");

// Call a tool (automatically routes to the correct server)
const result = await client.callTool({ 
  name: "myTool", 
  arguments: { param1: "value" } 
});

// Call a tool on a specific server
const result2 = await client.callTool({ 
  name: "myTool", 
  arguments: { param1: "value" } 
}, "server1");

// List all prompts from all servers
const { prompts } = await client.listPrompts();
console.log("Available prompts:", prompts);

// List prompts from a specific server
const { prompts: server2Prompts } = await client.listPrompts({}, "server2");

// Get a specific prompt (automatically finds the server)
const prompt = await client.getPrompt({ id: "prompt1" });

// Get a specific prompt from a specific server
const prompt2 = await client.getPrompt({ id: "prompt1" }, "server1");

// Work with resources
const { resources } = await client.listResources();
const { templates } = await client.listResourceTemplates();
const resource = await client.readResource({ id: "resource1" });

// Work with resources on specific servers
const { resources: server1Resources } = await client.listResources({}, "server1");
const { templates: server2Templates } = await client.listResourceTemplates({}, "server2");
const resource2 = await client.readResource({ id: "resource1" }, "server1");

// Ping all servers
const pingResults = await client.ping();
console.log("Ping results:", pingResults);

// Ping a specific server
const server1Ping = await client.ping({}, "server1");

// Send a completion request to a specific server
const completion = await client.complete(
  { prompt: "Hello, world!", maxTokens: 100 },
  {},
  "server1"
);

// Clean up when done
await client.disconnect();
```

## API Reference

### Constructor

```javascript
new MCPMulticlient(options)
```

- `options.name` (string): Name of the client (default: "multi-client")
- `options.version` (string): Version of the client
- `options.verbose` (boolean): Enable verbose logging (default: false)

### Connection Methods

#### `connect(transportOrPath, options)`

Connects to an MCP server.

- `transportOrPath` (string|object): Path to server executable, URL for HTTP servers, or a transport object
- `options.serverName` (string): Unique name for this server connection (generated if not provided)
- `options.args` (string[]): Command line arguments for stdio servers
- `options.env` (object): Environment variables for stdio servers
- **Returns**: Promise<{client, serverName}>

#### `disconnectServer(serverName)`

Disconnects from a specific server.

- `serverName` (string): Name of the server to disconnect from
- **Returns**: Promise<boolean>

#### `disconnect()`

Disconnects from all servers.

- **Returns**: Promise<void>

### Client Management

#### `getClient(serverName)`

Gets a specific client by server name.

- `serverName` (string): Name of the server
- **Returns**: Client or undefined

#### `getAllClients()`

Gets all connected clients.

- **Returns**: Map<string, Client>

#### `registerCapabilities(capabilities)`

Dummy implementation that logs a warning. In a multiclient context, capabilities should be provided during client creation.

- `capabilities` (object): Capabilities to register
- **Note**: This method only provides a warning and doesn't actually register capabilities

#### `ping(options, serverName)`

Pings a specific server or all servers.

- `options` (object): Optional request options
- `serverName` (string): Optional server name to restrict the operation to
- **Returns**: Promise<{results, allSucceeded}>

#### `complete(params, options, serverName)`

Makes a completion request to a specific server.

- `params` (object): Parameters for the completion request
- `options` (object): Optional request options
- `serverName` (string): Required server name to send the completion request to
- **Returns**: Promise<object>

#### `setLoggingLevel(level, options, serverName)`

Sets the logging level on a specific server or all servers.

- `level` (string): Logging level to set
- `options` (object): Optional request options
- `serverName` (string): Optional server name to restrict the operation to
- **Returns**: Promise<{results, allSucceeded}>

#### `getServerCapabilities(serverName)`

Gets server capabilities for a specific server.

- `serverName` (string): Required server name to get capabilities for
- **Returns**: object|undefined

#### `getServerVersion(serverName)`

Gets server version information for a specific server.

- `serverName` (string): Required server name to get version for
- **Returns**: object|undefined

#### `getInstructions(serverName)`

Gets server instructions for a specific server.

- `serverName` (string): Required server name to get instructions for
- **Returns**: string|undefined

### Tool Methods

#### `listTools(params, serverName)`

Lists all tools from all connected servers or a specific server.

- `params` (object): Optional parameters to pass to the server
- `serverName` (string): Optional server name to restrict the operation to
- **Returns**: Promise<{tools: Array<{name, description, client, serverName}>}>

#### `callTool(options, serverName)`

Calls a tool on the appropriate server or a specific server.

- `options.name` (string): Name of the tool to call
- `options.arguments` (object): Arguments to pass to the tool
- `serverName` (string): Optional server name to restrict the operation to
- **Returns**: Promise<object>

### Prompt Methods

#### `listPrompts(params, serverName)`

Lists all prompts from all connected servers or a specific server.

- `params` (object): Optional parameters to pass to the server
- `serverName` (string): Optional server name to restrict the operation to
- **Returns**: Promise<{prompts: Array<{id, title, client, serverName}>}>

#### `getPrompt(params, serverName)`

Gets a specific prompt from the appropriate server or a specific server.

- `params.id` (string): ID of the prompt to get
- `serverName` (string): Optional server name to restrict the operation to
- **Returns**: Promise<object>

### Resource Methods

#### `listResources(params, serverName)`

Lists all resources from all connected servers or a specific server.

- `params` (object): Optional parameters to pass to the server
- `serverName` (string): Optional server name to restrict the operation to
- **Returns**: Promise<{resources: Array<{id, name, client, serverName}>}>

#### `listResourceTemplates(params, serverName)`

Lists all resource templates from all connected servers or a specific server.

- `params` (object): Optional parameters to pass to the server
- `serverName` (string): Optional server name to restrict the operation to
- **Returns**: Promise<{templates: Array<{id, name, client, serverName}>}>

#### `readResource(params, serverName)`

Reads a specific resource from the appropriate server or a specific server.

- `params.id` (string): ID of the resource to read
- `serverName` (string): Optional server name to restrict the operation to
- **Returns**: Promise<object>

#### `subscribeResource(params, serverName)`

Subscribes to resource updates from the appropriate server or a specific server.

- `params.id` (string): ID of the resource to subscribe to
- `serverName` (string): Optional server name to restrict the operation to
- **Returns**: Promise<object>

#### `unsubscribeResource(params, serverName)`

Unsubscribes from resource updates from the appropriate server or a specific server.

- `params.id` (string): ID of the resource to unsubscribe from
- `serverName` (string): Optional server name to restrict the operation to
- **Returns**: Promise<object>

## Error Handling

All methods include proper error handling:

- Connection errors are logged and rethrown
- Missing resources or tools result in descriptive error messages
- Server-specific errors are captured and logged
- When a serverName is specified but not found, an appropriate error is thrown

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
