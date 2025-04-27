import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import spawnClient from "../spawn-client.mjs";
import DeclarativeMCPServer from "../declaritive-mcp-server.mjs";
import MulticlientTransport from "../index.mjs";
import { z } from "zod";

const clientPrefix = await spawnClient(
  new DeclarativeMCPServer({
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
          formality: z.string().optional(),
        },
        async ({ name = "World", formality = "" }) => {
          const text =
            formality === "FORMAL"
              ? `Dear ${name}, welcome to our service.`
              : `Hi ${name}! Welcome aboard!`;
          return {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text,
                },
              },
            ],
          };
        },
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
  }),
  {
    name: "client_prefix",
    version: "1.0.0",
  }
);

const clientSuffix = await spawnClient(
  new DeclarativeMCPServer({
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
          formality: z.string().optional(),
        },
        async ({ name = "User", formality = "" }) => {
          const text =
            formality === "FORMAL"
              ? `Thank you for your time, ${name}. We hope to see you again.`
              : `Bye ${name}! Come back soon!`;
          return {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text,
                },
              },
            ],
          };
        },
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
  }),
  {
    name: "client_suffix",
    version: "1.0.0",
  }
);

// Create a multiclient transport with both clients
const internalTransport = new MulticlientTransport([
  clientPrefix,
  clientSuffix,
]);

// Create main client connected to the multiclient transport
const client = new Client();
await client.connect(internalTransport);

export { clientPrefix, clientSuffix, internalTransport, client };
