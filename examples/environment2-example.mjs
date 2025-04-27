import { Client } from "@modelcontextprotocol/sdk/client.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ClientRouter } from "../index.mjs";

/**
 * Example demonstrating how to connect a ClientRouter to a StdioServerTransport
 * This is similar to the environment2.mjs example mentioned in the instructions
 */
async function main() {
  // Create a client linked to a mock server
  const [mockServerTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  
  // Create a client with a name for identification
  const client = new Client({
    name: "client",
    version: "1.0.0",
  });
  
  // Mock server behavior for the client to connect to
  mockServerTransport.onmessage = async (message) => {
    if (message.method === "initialize") {
      await mockServerTransport.send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "0.5.0",
          capabilities: {
            tools: true,
            resources: true,
            prompts: true,
          },
          serverInfo: {
            name: "MockServer",
            version: "1.0.0",
          },
        },
      });
      
      // Send initialized notification
      await mockServerTransport.send({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });
    }
  };
  
  // Connect client to the mock server
  await client.connect(clientTransport);
  console.log("Client connected to mock server");
  
  // Create a client router with the client
  const router = new ClientRouter([client]);
  
  // Connect the router to a StdioServerTransport
  // This allows external clients to connect to the router through stdio
  console.log("Connecting router to StdioServerTransport...");
  await router.connect(StdioServerTransport);
  console.log("Router connected to StdioServerTransport");
  
  // The router is now ready to receive messages from stdin and send responses to stdout
  console.log("Ready to receive messages. External clients can now connect to this process via stdio.");
  
  // Keep the process alive
  process.stdin.resume();
}

main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});