# MCP Declarative Server

A utility module for creating Model Context Protocol (MCP) servers declaratively.

## Installation

```bash
npm install mcp-client-router
```

## Usage

```javascript
import { DeclarativeMCPServer } from "mcp-client-router/declarative-server";

// Create a server declaratively
const server = new DeclarativeMCPServer({
  name: "my-server",
  version: "1.0.0",

  // Define tools as arrays of arguments
  tools: [
    [
      "greeting",
      { message: "string" },
      async ({ message }) => ({
        content: [{ type: "text", text: `Hello, ${message}!` }],
      }),
    ],
    [
      "farewell",
      { name: "string" },
      async ({ name }) => ({
        content: [{ type: "text", text: `Goodbye, ${name}!` }],
      }),
    ],
  ],

  // Define prompts
  prompts: [
    [
      "welcome",
      { name: "string", formality: { type: "string", default: "CASUAL" } },
      async ({ name, formality }) => {
        const text =
          formality === "FORMAL"
            ? `Dear ${name}, welcome to our service.`
            : `Hi ${name}! Welcome aboard!`;

        return {
          messages: [{ role: "assistant", content: { text } }],
        };
      },
      "A welcome prompt template",
    ],
  ],

  // Define resources
  resources: [
    [
      "docs/readme",
      async () => ({
        contents: [
          {
            uri: "docs/readme",
            text: "This is the documentation readme file.",
          },
        ],
      }),
    ],
  ],
});

// Connect to a transport
await server.connect(transport);
```

## API Reference

### `DeclarativeMCPServer`

```javascript
new DeclarativeMCPServer(options);
```

#### Options

- `name` (string): The name of the server
- `version` (string): The version of the server
- `tools` (array): An array of tool definitions
- `prompts` (array): An array of prompt definitions
- `resources` (array): An array of resource definitions

#### Tool Definition Format

```javascript
[
  name, // string: name of the tool
  paramSchema, // object: parameter schema
  handler, // function: async function to handle the tool call
  description, // string (optional): description of the tool
];
```

#### Prompt Definition Format

```javascript
[
  name, // string: name of the prompt
  paramSchema, // object: parameter schema
  handler, // function: async function to handle the prompt
  description, // string (optional): description of the prompt
];
```

#### Resource Definition Format

```javascript
[
  uri, // string: URI of the resource
  handler, // function: async function to handle the resource request
];
```

## License

ISC
