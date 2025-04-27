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
    prompts: [
      [
        "greeting",
        {
          name: z.string().optional(),
          formal: z.boolean().optional(),
        },
        async ({ name = "World", formal = false } = {}) => ({
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: formal
                  ? `Dear ${name}, welcome to our service.`
                  : `Hi ${name}! Welcome aboard!`,
              },
            },
          ],
        }),
      ],
    ],
    resources: [
      // [
      //   "readme",
      //   "A simple readme resource",
      //   async () => ({
      //     contents: [
      //       {
      //         uri: "readme://prefix",
      //         text: "This is the prefix server readme.",
      //       },
      //     ],
      //   }),
      // ],
    ],
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

// // Test direct client calls
// test("direct client calls work correctly", async (t) => {
//   const { clientPrefix, clientSuffix } = await setupTestEnvironment();

//   // Test prefix client tool_a
//   const result1 = await clientPrefix.callTool({
//     name: "tool_a",
//     arguments: { message: "hello" },
//   });
//   assert.deepStrictEqual(result1, {
//     content: [{ type: "text", text: "a hello" }],
//   });

//   // Test prefix client tool_b
//   const result2 = await clientPrefix.callTool({
//     name: "tool_b",
//     arguments: { message: "hello" },
//   });
//   assert.deepStrictEqual(result2, {
//     content: [{ type: "text", text: "b hello" }],
//   });

//   // Test suffix client tool_a
//   const result3 = await clientSuffix.callTool({
//     name: "tool_a",
//     arguments: { message: "hello" },
//   });
//   assert.deepStrictEqual(result3, {
//     content: [{ type: "text", text: "hello a" }],
//   });

//   // Test suffix client tool_1
//   const result4 = await clientSuffix.callTool({
//     name: "tool_1",
//     arguments: { message: "hello" },
//   });
//   assert.deepStrictEqual(result4, {
//     content: [{ type: "text", text: "hello 1" }],
//   });
// });

// // Test multiclient transport tool calls
// test("multiclient transport correctly routes prefixed tool calls", async (t) => {
//   const { client } = await setupTestEnvironment();

//   // Test client_prefix__tool_a
//   const result1 = await client.callTool({
//     name: "client_prefix__tool_a",
//     arguments: { message: "hello" },
//   });
//   assert.deepStrictEqual(result1, {
//     content: [{ type: "text", text: "a hello" }],
//   });

//   // Test client_prefix__tool_b
//   const result2 = await client.callTool({
//     name: "client_prefix__tool_b",
//     arguments: { message: "hello" },
//   });
//   assert.deepStrictEqual(result2, {
//     content: [{ type: "text", text: "b hello" }],
//   });

//   // Test client_suffix__tool_a
//   const result3 = await client.callTool({
//     name: "client_suffix__tool_a",
//     arguments: { message: "hello" },
//   });
//   assert.deepStrictEqual(result3, {
//     content: [{ type: "text", text: "hello a" }],
//   });

//   // Test client_suffix__tool_1
//   const result4 = await client.callTool({
//     name: "client_suffix__tool_1",
//     arguments: { message: "hello" },
//   });
//   assert.deepStrictEqual(result4, {
//     content: [{ type: "text", text: "hello 1" }],
//   });
// });

// // Test tool listing
// test("multiclient transport correctly lists and prefixes all tools", async (t) => {
//   const { client } = await setupTestEnvironment();

//   // Get all tools
//   const { tools } = await client.listTools();

//   // There should be 4 tools
//   assert.strictEqual(tools.length, 4);

//   // Check that all expected tools are present with correct prefixed names
//   const toolNames = tools.map((tool) => tool.name);
//   assert.ok(toolNames.includes("client_prefix__tool_a"));
//   assert.ok(toolNames.includes("client_prefix__tool_b"));
//   assert.ok(toolNames.includes("client_suffix__tool_a"));
//   assert.ok(toolNames.includes("client_suffix__tool_1"));

//   // Check that descriptions are preserved
//   const toolA = tools.find((tool) => tool.name === "client_prefix__tool_a");
//   assert.strictEqual(toolA.description, "add prefix 'a' to message");
// });

// // Test error handling for non-existent tools
// test("multiclient transport correctly handles non-existent tools", async (t) => {
//   const { client } = await setupTestEnvironment();

//   // Try to call a non-existent tool
//   await assert.rejects(
//     async () => {
//       await client.callTool({
//         name: "client_prefix__non_existent_tool",
//         arguments: { message: "hello" },
//       });
//     },
//     (err) => {
//       // Check that we get the expected error
//       return err.message.includes("not found");
//     }
//   );

//   // Try to call a tool with wrong client prefix
//   await assert.rejects(
//     async () => {
//       await client.callTool({
//         name: "non_existent_client__tool_a",
//         arguments: { message: "hello" },
//       });
//     },
//     (err) => {
//       // Check that we get the expected error
//       return err.message.includes("not found");
//     }
//   );
// });

// // Test error handling for invalid tool names
// test("multiclient transport correctly handles invalid tool names", async (t) => {
//   const { client } = await setupTestEnvironment();

//   // Try to call a tool without a proper prefix
//   await assert.rejects(
//     async () => {
//       await client.callTool({
//         name: "invalid_tool_name_without_prefix",
//         arguments: { message: "hello" },
//       });
//     },
//     (err) => {
//       // Check that we get the expected error
//       return err.message.includes("not found");
//     }
//   );
// });

// // Test prompt handling
// test("multiclient transport correctly lists and prefixes all prompts", async (t) => {
//   const { client } = await setupTestEnvironment();

//   // Get all prompts
//   const { prompts } = await client.listPrompts();

//   // There should be 2 prompts
//   assert.strictEqual(prompts.length, 2);

//   // Check that all expected prompts are present with correct prefixed names
//   const promptNames = prompts.map((prompt) => prompt.name);
//   assert.ok(promptNames.includes("client_prefix__greeting"));
//   assert.ok(promptNames.includes("client_suffix__farewell"));

//   // Check that descriptions are preserved
//   const greeting = prompts.find(
//     (prompt) => prompt.name === "client_prefix__greeting"
//   );
//   assert.strictEqual(greeting.description, "A greeting prompt template");
// });

test("multiclient transport correctly gets prompts", async (t) => {
  const { client } = await setupTestEnvironment();

  // Get a specific prompt from the prefix client

  const prefixResult = await client.getPrompt({
    name: "client_prefix__greeting",
    arguments: { name: "Test", formal: undefined },
  });

  assert.ok(prefixResult.messages?.length);
  // assert.strictEqual(prefixResult.prompt.name, "client_prefix__greeting");
  // assert.strictEqual(
  //   prefixResult.prompt.description,
  //   "A greeting prompt template"
  // );

  // // Get a specific prompt from the suffix client
  // const suffixResult = await client.getPrompt({
  //   name: "client_suffix__farewell",
  //   arguments: { name: "User", formal: true },
  // });

  // assert.ok(suffixResult.prompt);
  // assert.strictEqual(suffixResult.prompt.name, "client_suffix__farewell");
  // assert.strictEqual(
  //   suffixResult.prompt.description,
  //   "A farewell prompt template"
  // );

  // // Test handling of non-existent prompt
  // await assert.rejects(
  //   async () => {
  //     await client.getPrompt({
  //       name: "client_prefix__nonexistent",
  //       arguments: {},
  //     });
  //   },
  //   (err) => {
  //     return err.message.includes("not found");
  //   }
  // );
});

// // Test resource handling
// test("multiclient transport correctly lists and prefixes all resources", async (t) => {
//   const { client } = await setupTestEnvironment();

//   // Get all resources
//   const { resources } = await client.listResources();

//   // There should be 2 resources
//   assert.strictEqual(resources.length, 2);

//   // Check that all expected resources have their URIs properly prefixed
//   const resourceUris = resources.map((resource) => resource.uri);

//   // Check for the prefixed URIs with simple prefix format
//   const prefixUriFound = resourceUris.some((uri) =>
//     uri.includes("client_prefix__readme")
//   );
//   const suffixUriFound = resourceUris.some((uri) =>
//     uri.includes("client_suffix__docs")
//   );

//   assert.ok(prefixUriFound, "Prefix resource URI not found");
//   assert.ok(suffixUriFound, "Suffix resource URI not found");
// });

// test("multiclient transport correctly reads resources", async (t) => {
//   const { client } = await setupTestEnvironment();

//   // Get all resources to get the prefixed URIs
//   const { resources } = await client.listResources();

//   // Find the specific resources - use the simple prefix format now
//   const prefixResourceUri = resources.find(
//     (r) => r.uri && r.uri.startsWith("client_prefix__")
//   )?.uri;

//   const suffixResourceUri = resources.find(
//     (r) => r.uri && r.uri.startsWith("client_suffix__")
//   )?.uri;

//   assert.ok(prefixResourceUri, "Prefix resource URI not found");
//   assert.ok(suffixResourceUri, "Suffix resource URI not found");

//   // Read the resources with their prefixed URIs
//   const prefixResult = await client.readResource({ uri: prefixResourceUri });

//   assert.ok(prefixResult.contents);
//   assert.strictEqual(prefixResult.contents.length, 1);
//   assert.strictEqual(
//     prefixResult.contents[0].text,
//     "This is the prefix server readme."
//   );

//   // Ensure the URI in the content is also prefixed
//   assert.ok(prefixResult.contents[0].uri.includes("client_prefix"));

//   // Read the suffix resource
//   const suffixResult = await client.readResource({ uri: suffixResourceUri });

//   assert.ok(suffixResult.contents);
//   assert.strictEqual(suffixResult.contents.length, 1);
//   assert.strictEqual(
//     suffixResult.contents[0].text,
//     "This is the suffix server API documentation."
//   );

//   // Ensure the URI in the content is also prefixed
//   assert.ok(suffixResult.contents[0].uri.includes("client_suffix"));

//   // Test handling of non-existent resource
//   await assert.rejects(
//     async () => {
//       await client.readResource({ uri: "client_prefix__nonexistent" });
//     },
//     (err) => {
//       return err.message.includes("not found");
//     }
//   );
// });
