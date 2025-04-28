import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import spawnClient from "../lib/mcp-spawn-client/index.mjs";
import DeclarativeMCPServer from "../lib/mcp-declarative-server/index.mjs";
import { ClientRouter } from "../src/index.mjs";
import { z } from "zod";

const createServerPrefix = () =>
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
        "readme://prefix",
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

const createServerSuffix = () =>
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
        "docs",
        "docs://suffix/api",
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

const getClient = async (method = "transport") => {
  const clientPrefix = await spawnClient(createServerPrefix(), {
    name: "client_prefix",
    version: "1.0.0",
  });

  const clientSuffix = await spawnClient(createServerSuffix(), {
    name: "client_suffix",
    version: "1.0.0",
  });
  const client = new Client({
    name: "client",
    version: "1.0.0",
  });
  switch (method) {
    case "transport": {
      // Connect to router directly as a transport
      const router = new ClientRouter([clientPrefix, clientSuffix]);
      await client.connect(router);
      return client;
    }
    case "server":
    default: {
      // Connect to router via transport as a server
      const [serverTransport, clientTransport] =
        InMemoryTransport.createLinkedPair();
      const router = new ClientRouter([clientPrefix, clientSuffix]);
      await router.connect(serverTransport);
      await client.connect(clientTransport);
      return client;
    }
  }
};
const client = await getClient("transport");
const client2 = await getClient("server");

export { createServerPrefix, createServerSuffix };
export { client, client2 };
