import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ClientRouter } from "./client-router.mjs";
const fromObject = async (obj = {}, options) => {
  const clients = [];
  const { mcpServers = [] } = obj;
  for (const [name, value] of Object.entries(mcpServers) || []) {
    if (value.enabled === false) {
      continue;
    }
    const client = new Client({
      name,
      version: "1.0.0",
    });
    if ("command" in value) {
      await client.connect(
        new StdioClientTransport({
          command: value.command,
          args: value.args || [],
          env: value.env || {},
        })
      );
    } else {
      await client.connect(
        new StreamableHTTPClientTransport(value.url, value.options)
      );
    }
    clients.push(client);
  }
  return new ClientRouter(clients);
};
export { fromObject };
export default fromObject;
