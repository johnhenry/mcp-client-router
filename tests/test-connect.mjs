import { test } from "node:test";
import assert from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { router } from "./environment.mjs";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

test("ClientRouter.connect sets up event handlers correctly", async (t) => {
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({
    name: "client",
    version: "1.0.0",
  });
  // Create transports
  await router.connect(serverTransport);
  await client.connect(clientTransport);
  assert.equal((await client.listPrompts()).length, 0);
  // // Verify that the transport is returned
});
