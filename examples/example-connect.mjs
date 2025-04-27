import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ClientRouter } from "../index.mjs";

/**
 * Example demonstrating how to connect a ClientRouter to a server transport
 * 
 * This creates a setup where:
 * 1. Two clients are created and connected to mock MCP servers
 * 2. These clients are added to a ClientRouter
 * 3. The router is connected to a StdioServerTransport
 * 4. Another client can connect to this router through the StdioServerTransport
 * 
 * The end result is a composition where external clients can use tools, prompts,
 * and resources from multiple backend servers through a single interface.
 */
async function main() {
  // Create our first client connected to a mock server
  const [serverTransport1, clientTransport1] = InMemoryTransport.createLinkedPair();
  const client1 = new Client({
    name: "client_1",
    version: "1.0.0",
  });
  
  // Mock initialization response for client1
  serverTransport1.onmessage = async (message) => {
    if (message.method === "initialize") {
      await serverTransport1.send({
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
            name: "MockServer1",
            version: "1.0.0",
          },
        },
      });
      
      // Send initialized notification
      await serverTransport1.send({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });
    }
  };
  
  await client1.connect(clientTransport1);
  console.log("Client 1 connected");
  
  // Create our second client connected to a mock server
  const [serverTransport2, clientTransport2] = InMemoryTransport.createLinkedPair();
  const client2 = new Client({
    name: "client_2",
    version: "1.0.0",
  });
  
  // Mock initialization response for client2
  serverTransport2.onmessage = async (message) => {
    if (message.method === "initialize") {
      await serverTransport2.send({
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
            name: "MockServer2",
            version: "1.0.0",
          },
        },
      });
      
      // Send initialized notification
      await serverTransport2.send({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });
    }
  };
  
  await client2.connect(clientTransport2);
  console.log("Client 2 connected");
  
  // Create a ClientRouter with both clients
  const router = new ClientRouter([client1, client2]);
  console.log("Created ClientRouter with both clients");
  
  // Connect the router to a StdioServerTransport
  console.log("Connecting router to StdioServerTransport...");
  await router.connect(new StdioServerTransport());
  console.log("Router connected to StdioServerTransport");
  
  // The router is now ready to receive and process messages from stdin
  // and will respond to stdout, acting as an MCP server
  
  console.log("Ready to receive messages from stdin");
  
  // Keep the process alive
  process.stdin.resume();
}

main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});