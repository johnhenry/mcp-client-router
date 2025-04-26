import { test } from "node:test";
import assert from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import spawnClient from "./spawn-client.mjs";
import DeclarativeMCPServer from "./declaritive-mcp-server.mjs";
import MulticlientTransport from "./index.mjs";
import { z } from "zod";

// Helper function to create test servers and clients
async function setupTestEnvironment() {
  // Set up prefix server with two tools
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

  // Set up suffix server with two tools
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

  // Create clients connected to each server
  const clientPrefix = await spawnClient(serverPrefix, {
    name: "client_prefix",
    version: "1.0.0",
  });

  const clientSuffix = await spawnClient(serverSuffix, {
    name: "client_suffix",
    version: "1.0.0",
  });

  // Create a multiclient transport with both clients
  const internalTransport = new MulticlientTransport([
    clientPrefix,
    clientSuffix,
  ]);

  // Create main client connected to the multiclient transport
  const client = new Client();
  await client.connect(internalTransport);

  return {
    serverPrefix,
    serverSuffix,
    clientPrefix,
    clientSuffix,
    internalTransport,
    client,
  };
}

// Test direct client calls
test("direct client calls work correctly", async (t) => {
  const { clientPrefix, clientSuffix } = await setupTestEnvironment();

  // Test prefix client tool_a
  const result1 = await clientPrefix.callTool({
    name: "tool_a",
    arguments: { message: "hello" },
  });
  assert.deepStrictEqual(result1, {
    content: [{ type: "text", text: "a hello" }],
  });

  // Test prefix client tool_b
  const result2 = await clientPrefix.callTool({
    name: "tool_b",
    arguments: { message: "hello" },
  });
  assert.deepStrictEqual(result2, {
    content: [{ type: "text", text: "b hello" }],
  });

  // Test suffix client tool_a
  const result3 = await clientSuffix.callTool({
    name: "tool_a",
    arguments: { message: "hello" },
  });
  assert.deepStrictEqual(result3, {
    content: [{ type: "text", text: "hello a" }],
  });

  // Test suffix client tool_1
  const result4 = await clientSuffix.callTool({
    name: "tool_1",
    arguments: { message: "hello" },
  });
  assert.deepStrictEqual(result4, {
    content: [{ type: "text", text: "hello 1" }],
  });
});

// Test multiclient transport tool calls
test("multiclient transport correctly routes prefixed tool calls", async (t) => {
  const { client } = await setupTestEnvironment();

  // Test client_prefix__tool_a
  const result1 = await client.callTool({
    name: "client_prefix__tool_a",
    arguments: { message: "hello" },
  });
  assert.deepStrictEqual(result1, {
    content: [{ type: "text", text: "a hello" }],
  });

  // Test client_prefix__tool_b
  const result2 = await client.callTool({
    name: "client_prefix__tool_b",
    arguments: { message: "hello" },
  });
  assert.deepStrictEqual(result2, {
    content: [{ type: "text", text: "b hello" }],
  });

  // Test client_suffix__tool_a
  const result3 = await client.callTool({
    name: "client_suffix__tool_a",
    arguments: { message: "hello" },
  });
  assert.deepStrictEqual(result3, {
    content: [{ type: "text", text: "hello a" }],
  });

  // Test client_suffix__tool_1
  const result4 = await client.callTool({
    name: "client_suffix__tool_1",
    arguments: { message: "hello" },
  });
  assert.deepStrictEqual(result4, {
    content: [{ type: "text", text: "hello 1" }],
  });
});

// Test tool listing
test("multiclient transport correctly lists and prefixes all tools", async (t) => {
  const { client } = await setupTestEnvironment();

  // Get all tools
  const { tools } = await client.listTools();

  // There should be 4 tools
  assert.strictEqual(tools.length, 4);

  // Check that all expected tools are present with correct prefixed names
  const toolNames = tools.map((tool) => tool.name);
  assert.ok(toolNames.includes("client_prefix__tool_a"));
  assert.ok(toolNames.includes("client_prefix__tool_b"));
  assert.ok(toolNames.includes("client_suffix__tool_a"));
  assert.ok(toolNames.includes("client_suffix__tool_1"));

  // Check that descriptions are preserved
  const toolA = tools.find((tool) => tool.name === "client_prefix__tool_a");
  assert.strictEqual(toolA.description, "add prefix 'a' to message");
});

// Test error handling for non-existent tools
test("multiclient transport correctly handles non-existent tools", async (t) => {
  const { client } = await setupTestEnvironment();

  // Try to call a non-existent tool
  await assert.rejects(
    async () => {
      await client.callTool({
        name: "client_prefix__non_existent_tool",
        arguments: { message: "hello" },
      });
    },
    (err) => {
      // Check that we get the expected error
      return err.message.includes("not found");
    }
  );

  // Try to call a tool with wrong client prefix
  await assert.rejects(
    async () => {
      await client.callTool({
        name: "non_existent_client__tool_a",
        arguments: { message: "hello" },
      });
    },
    (err) => {
      // Check that we get the expected error
      return err.message.includes("not found");
    }
  );
});

// Test error handling for invalid tool names
test("multiclient transport correctly handles invalid tool names", async (t) => {
  const { client } = await setupTestEnvironment();

  // Try to call a tool without a proper prefix
  await assert.rejects(
    async () => {
      await client.callTool({
        name: "invalid_tool_name_without_prefix",
        arguments: { message: "hello" },
      });
    },
    (err) => {
      // Check that we get the expected error
      return err.message.includes("not found");
    }
  );
});
