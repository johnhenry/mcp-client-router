import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import spawnClient from "./spawn-client.mjs";
import DeclarativeMCPServer from "./declaritive-mcp-server.mjs";
import MultiClientTransport from "./index.mjs"; // TODO: Create
import { z } from "zod";

const serverPrefix = new DeclarativeMCPServer({
  name: "server_prefix",
  version: "1.0.0",
  tools: [
    [
      "tool_a",
      "add prefix 'a' to message",
      { message: z.string() },
      async ({ message }) => ({
        content: [
          {
            type: "text",
            text: "a " + message,
          },
        ],
      }),
    ],
    [
      "tool_b",
      "add prefix 'b' to message",
      { message: z.string() },
      async ({ message }) => ({
        content: [
          {
            type: "text",
            text: "b " + message,
          },
        ],
      }),
    ],
  ],
  prompts: [
    [
      "greeting",
      "A greeting prompt template",
      {
        name: z.string().optional(),
        formal: z.boolean().optional(),
      },
      async ({ name = "World", formal = false }) => ({
        content: [
          {
            type: "text",
            text: formal
              ? `Dear ${name}, welcome to our service.`
              : `Hi ${name}! Welcome aboard!`,
          },
        ],
      }),
    ],
  ],
  resources: [
    [
      "readme",
      "A simple readme resource",
      async () => ({
        contents: [
          {
            uri: "readme://prefix",
            text: "This is the prefix server readme.",
          },
        ],
      }),
    ],
  ],
});

const serverSuffix = new DeclarativeMCPServer({
  name: "server_suffix",
  version: "1.0.0",
  tools: [
    [
      "tool_a",
      "Add suffix 'a' to message",
      { message: z.string() },
      async ({ message }) => ({
        content: [
          {
            type: "text",
            text: message + " a",
          },
        ],
      }),
    ],
    [
      "tool_1",
      "Add suffix '1' to message",
      { message: z.string() },
      async ({ message }) => ({
        content: [
          {
            type: "text",
            text: message + " 1",
          },
        ],
      }),
    ],
  ],
  prompts: [
    [
      "farewell",
      "A farewell prompt template",
      {
        name: z.string().optional(),
        formal: z.boolean().optional(),
      },
      async ({ name = "User", formal = false }) => ({
        content: [
          {
            type: "text",
            text: formal
              ? `Thank you for your time, ${name}. We hope to see you again.`
              : `Bye ${name}! Come back soon!`,
          },
        ],
      }),
    ],
  ],
  resources: [
    [
      "documentation",
      "API documentation resource",
      async () => ({
        contents: [
          {
            uri: "docs://suffix/api",
            text: "This is the suffix server API documentation.",
          },
        ],
      }),
    ],
  ],
});
const clientPrefix = await spawnClient(serverPrefix, {
  name: "client_prefix",
  version: "1.0.0",
});

console.log(
  await clientPrefix.callTool({
    name: "tool_a",
    arguments: { message: "hello" },
  })
); // Prints: { content: [ { type: 'text', text: 'a hello' } ] }
console.log(
  await clientPrefix.callTool({
    name: "tool_b",
    arguments: { message: "hello" },
  })
); // Prints: { content: [ { type: 'text', text: 'b hello' } ] }

const clientSuffix = await spawnClient(serverSuffix, {
  name: "client_suffix",
  version: "1.0.0",
});

console.log(
  await clientSuffix.callTool({
    name: "tool_a",
    arguments: { message: "hello" },
  })
); // Prints: { content: [ { type: 'text', text: 'hello a' } ] }
console.log(
  await clientSuffix.callTool({
    name: "tool_1",
    arguments: { message: "hello" },
  })
); // Prints: { content: [ { type: 'text', text: 'hello 1' } ] }

const internalTransport = new MultiClientTransport([
  clientPrefix,
  clientSuffix,
]);
const client = new Client();
await client.connect(internalTransport);
console.log(await client.listTools()); // Prints:{ tools:[ { name: 'client_prefix__tool_a', ... }, { name: 'client_prefix__tool_b', ... },...]}

console.log(
  await client.callTool({
    name: "client_prefix__tool_a",
    arguments: { message: "hello" },
  })
); // Prints: { content: [ { type: 'text', text: 'a hello' } ] }

console.log(
  await client.callTool({
    name: "client_prefix__tool_b",
    arguments: { message: "hello" },
  })
); // Prints: { content: [ { type: 'text', text: 'b hello' } ] }

console.log(
  await client.callTool({
    name: "client_suffix__tool_a",
    arguments: { message: "hello" },
  })
); // Prints: { content: [ { type: 'text', text: 'hello a' } ] }

console.log(
  await client.callTool({
    name: "client_suffix__tool_1",
    arguments: { message: "hello" },
  })
); // Prints: { content: [ { type: 'text', text: 'hello 1' } ] }

// List all prompts
console.log(await client.listPrompts()); // Prints: { prompts: [{ name: 'client_prefix__greeting', ... }, { name: 'client_suffix__farewell', ... }] }

// Get a specific prompt
console.log(
  await client.getPrompt({
    name: "client_prefix__greeting",
    arguments: { name: "John", formal: true }
  })
); // Prints: { prompt: { name: 'client_prefix__greeting', description: 'A greeting prompt template', ... } }

// List all resources
console.log(await client.listResources()); // Prints: { resources: [{ uri: 'client_prefix__readme://prefix', ... }, { uri: 'client_suffix__docs://suffix/api', ... }] }

// Get the resource URI from the listResources result
const resources = await client.listResources();
const prefixResourceUri = resources.resources.find(r => r.uri && r.uri.startsWith("client_prefix__"))?.uri;

// Read a specific resource
console.log(
  await client.readResource({ uri: prefixResourceUri })
); // Prints: { contents: [{ uri: 'client_prefix__readme://prefix', text: 'This is the prefix server readme.' }] }
