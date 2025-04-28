import { test } from "node:test";
import assert from "node:assert";
import process from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { fromObject } from "../src/index.mjs";
import closeServer from "./start-http-server.mjs"; // Ensure the server is imported to register tools
const PORT = process.env.PORT_FOR_SERVER;
const DIR = process.env.PATH_TO_REPO;
const NODE = process.env.PATH_TO_NODE;

const router = await fromObject(
  {
    mcpServers: {
      client_prefix: {
        disabled: false,
        command: NODE,
        args: [`${DIR}/tests/stdio-server.mjs`],
      },
      client_suffix: {
        url: `http://localhost:${PORT}/mcp`,
      },
    },
  },
  {
    allow: [],
    deny: [],
  }
);
const client = new Client({
  name: "client",
  version: "1.0.0",
});
await client.connect(router);

await test("ClientRouter.connect sets up event handlers correctly", async (t) => {
  // Test that we can retrieve the prompts (should be 2 from environment.mjs)
  const promptsResult = await client.listPrompts();
  assert.ok(promptsResult.prompts, "Should return prompts");
  assert.equal(promptsResult.prompts.length, 2, "Should return two prompts");

  // Test that we can retrieve the tools (should be 4 from environment.mjs)
  const toolsResult = await client.listTools();
  assert.ok(toolsResult.tools, "Should return tools");
  assert.equal(toolsResult.tools.length, 4, "Should return four tools");

  // Test that we can retrieve the resources (should be 2 from environment.mjs)
  const resourcesResult = await client.listResources();
  assert.ok(resourcesResult.resources, "Should return resources");
  assert.equal(
    resourcesResult.resources.length,
    2,
    "Should return two resources"
  );

  // Verify that the client can call a tool through the router
  const toolResult = await client.callTool({
    name: "client_prefix__tool_a",
    arguments: { message: "test" },
  });

  assert.deepStrictEqual(toolResult, {
    content: [{ type: "text", text: "a test" }],
  });
});

// Test multiclient transport tool calls
await test("multiclient transport correctly routes prefixed tool calls", async (t) => {
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
await test("multiclient transport correctly lists and prefixes all tools", async (t) => {
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
await test("multiclient transport correctly handles non-existent tools", async (t) => {
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
await test("multiclient transport correctly handles invalid tool names", async (t) => {
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

// Test prompt handling
await test("multiclient transport correctly lists and prefixes all prompts", async (t) => {
  // Get all prompts
  const { prompts } = await client.listPrompts();

  // There should be 2 prompts
  assert.strictEqual(prompts.length, 2);

  // Check that all expected prompts are present with correct prefixed names
  const promptNames = prompts.map((prompt) => prompt.name);
  assert.ok(promptNames.includes("client_prefix__greeting"));
  assert.ok(promptNames.includes("client_suffix__farewell"));

  // Check that descriptions are preserved
  const greeting = prompts.find(
    (prompt) => prompt.name === "client_prefix__greeting"
  );
  assert.strictEqual(greeting.description, "A greeting prompt template");
});

await test("multiclient transport correctly gets prompts", async (t) => {
  // Get a specific prompt from the prefix client

  const result1 = await client.getPrompt({
    name: "client_prefix__greeting",
    arguments: { name: "Test" },
  });
  assert.equal(
    result1.messages?.[0]?.content?.text,
    "Hi Test! Welcome aboard!"
  );

  const result2 = await client.getPrompt({
    name: "client_prefix__greeting",
    arguments: { name: "Test", formality: "FORMAL" },
  });
  assert.equal(
    result2.messages?.[0]?.content?.text,
    "Dear Test, welcome to our service."
  );

  // // Get a specific prompt from the suffix client
  const result11 = await client.getPrompt({
    name: "client_suffix__farewell",
    arguments: { name: "User" },
  });

  assert.equal(
    result11.messages?.[0]?.content?.text,
    "Bye User! Come back soon!"
  );
  const result22 = await client.getPrompt({
    name: "client_suffix__farewell",
    arguments: { name: "User", formality: "FORMAL" },
  });
  assert.equal(
    result22.messages?.[0]?.content?.text,
    "Thank you for your time, User. We hope to see you again."
  );

  // Test handling of non-existent prompt
  await assert.rejects(
    async () => {
      await client.getPrompt({
        name: "client_prefix__nonexistent",
        arguments: {},
      });
    },
    (err) => {
      return err.message.includes("not found");
    }
  );
});

// Test resource handling
await test("multiclient transport correctly lists and prefixes all resources", async (t) => {
  // Get all resources
  const { resources } = await client.listResources();
  // There should be 2 resources
  assert.strictEqual(resources.length, 2);

  // Check that all expected resources have their URIs properly prefixed
  const resourceUris = resources.map((resource) => resource.uri);

  // Check for the prefixed URIs with simple prefix format
  const prefixUriFound = resourceUris.some((uri) =>
    uri.includes("client_prefix__readme")
  );
  const suffixUriFound = resourceUris.some((uri) =>
    uri.includes("client_suffix__docs")
  );

  assert.ok(prefixUriFound, "Prefix resource URI not found");
  assert.ok(suffixUriFound, "Suffix resource URI not found");
});

await test("multiclient transport correctly reads resources", async (t) => {
  // Get all resources to get the prefixed URIs
  const { resources } = await client.listResources();

  // Find the specific resources - use the simple prefix format now
  const prefixResourceUri = resources.find(
    (r) => r.uri && r.uri.startsWith("client_prefix__")
  )?.uri;

  const suffixResourceUri = resources.find(
    (r) => r.uri && r.uri.startsWith("client_suffix__")
  )?.uri;

  assert.ok(prefixResourceUri, "Prefix resource URI not found");
  assert.ok(suffixResourceUri, "Suffix resource URI not found");

  // Read the resources with their prefixed URIs
  const prefixResult = await client.readResource({ uri: prefixResourceUri });

  assert.ok(prefixResult.contents);
  assert.strictEqual(prefixResult.contents.length, 1);
  assert.strictEqual(
    prefixResult.contents[0].text,
    "This is the prefix server readme."
  );

  // Ensure the URI in the content is also prefixed
  assert.ok(prefixResult.contents[0].uri.includes("client_prefix"));

  // Read the suffix resource
  const suffixResult = await client.readResource({ uri: suffixResourceUri });

  assert.ok(suffixResult.contents);
  assert.strictEqual(suffixResult.contents.length, 1);
  assert.strictEqual(
    suffixResult.contents[0].text,
    "This is the suffix server API documentation."
  );

  // Ensure the URI in the content is also prefixed
  assert.ok(suffixResult.contents[0].uri.includes("client_suffix"));

  // Test handling of non-existent resource
  await assert.rejects(
    async () => {
      return await client.readResource({
        uri: "client_prefix__nonexistent",
      });
    },
    (err) => {
      return err.message.includes("Invalid URL");
    }
  );
});

await router.close();
closeServer();
