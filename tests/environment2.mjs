import { Client } from "@modelcontextprotocol/sdk/client.js";
import { router } from "@modelcontextprotocol/sdk/client.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
const client2 = new Client({
  name: "client",
  version: "1.0.0",
});
await client2.connect(clientTransport);
router.connect(serverTransport);
export { client2 };
