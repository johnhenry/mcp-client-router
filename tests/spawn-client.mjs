import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/**
 * Spawn a client connected to the server.
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server - The server to connect to.
 * @param  {...any} args - Arguments to pass to the client constructor.
 * @returns {Promise<Client>} - The connected client.
 */
const spawnClient = async (server, ...args) => {
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client(...args);
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
};

export { spawnClient };
export default spawnClient;
