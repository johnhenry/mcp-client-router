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
  prompts: [],
  resources: [],
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
  prompts: [],
  resources: [],
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

const internalTransport = new MultiClientTransport([clientA, clientB]);
const client = new Client();
await client.connect(internalTransport);
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
  await client.callTool("server_suffix__tool_1", {
    name: "client_suffix__tool_1",
    arguments: { message: "hello" },
  })
); // Prints: { content: [ { type: 'text', text: 'hello 1' } ] }
