/**
 * MulticlientTransport is a class that allows for the creation of multiple clients AND properly prefixes names of tool
 * @implements {Transport} // https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/src/shared/transport.ts
 * @param {Array} clients - The clients to be used in the transport.
 */
export const MulticlientTransport = class {
  #clients = [];

  onclose = undefined;
  onerror = undefined;
  onmessage = undefined;
  sessionId = undefined;

  constructor(clients = []) {
    this.#clients = [...clients];
    this.sessionId = `multiclient-${Date.now()}`;
  }

  /**
   * Starts processing messages on the transport
   */
  async start() {
    return Promise.resolve();
  }

  /**
   * Sends a JSON-RPC message to the appropriate client(s)
   */
  async send(message, options = {}) {
    try {
      // Handle different message types
      if (message.method === "initialize") {
        return this.#handleInitialize(message);
      }

      if (message.method === "notifications/initialized") {
        return;
      }

      if (message.method === "call_tool" || message.method === "tools/call") {
        return this.#handleToolCall(message, options);
      }

      if (message.method === "list_tools" || message.method === "tools/list") {
        return this.#handleListTools(message, options);
      }

      // For other messages, broadcast to all clients
      return this.#broadcastMessage(message, options);
    } catch (error) {
      console.error("Error in MulticlientTransport.send:", error);

      if (message.id) {
        this.#sendError(message.id, -32603, `Internal error: ${error.message}`);
      }

      if (this.onerror) {
        this.onerror(error);
      }
    }
  }

  /**
   * Closes the connection
   */
  async close() {
    if (this.onclose) {
      this.onclose();
    }
    return Promise.resolve();
  }

  /**
   * Handle the initialize message
   * @private
   */
  async #handleInitialize(message) {
    const response = {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "0.5.0",
        capabilities: {
          tools: true,
          resources: false,
          prompts: false,
        },
        serverInfo: {
          name: "MulticlientTransport",
          version: "1.0.0",
        },
      },
    };

    if (this.onmessage) {
      this.onmessage(response);
    }
  }

  /**
   * Handle a tool call (call_tool or tools/call)
   * @private
   */
  async #handleToolCall(message, options) {
    // Extract the prefixed name based on the method
    let prefixedName, toolArgs;

    if (message.method === "call_tool") {
      // Direct from params
      prefixedName = message.params?.name;
      toolArgs = message.params?.arguments;
    } else if (message.method === "tools/call") {
      // Nested in arguments
      if (message.params?.arguments) {
        prefixedName = message.params.arguments.name;
        toolArgs = message.params.arguments.arguments;
      } else {
        // Might be direct in params
        prefixedName = message.params?.name;
        toolArgs = message.params?.arguments;
      }
    }

    if (!prefixedName) {
      // Try to find name anywhere in the params structure
      if (message.params) {
        if (typeof message.params === "object") {
          // Direct in params
          if (message.params.name) {
            prefixedName = message.params.name;
            toolArgs = message.params.arguments;
          }
          // Check one level deeper
          else if (
            message.params.arguments &&
            typeof message.params.arguments === "object"
          ) {
            if (message.params.arguments.name) {
              prefixedName = message.params.arguments.name;
              toolArgs = message.params.arguments.arguments;
            }
          }
        }
      }
    }

    if (!prefixedName) {
      this.#sendError(message.id, -32602, "Missing tool name in call");
      return;
    }

    // Parse the tool name
    const parts = prefixedName.split("__");

    if (parts.length < 2) {
      this.#sendError(message.id, -32602, `Tool ${prefixedName} not found`);
      return;
    }

    const clientName = parts[0];
    const toolName = parts.slice(1).join("__");

    // Find the client by name
    const client = this.#clients.find(
      (c) => c._clientInfo?.name === clientName
    );

    if (!client) {
      this.#sendError(
        message.id,
        -32602,
        `Tool ${prefixedName} not found (client ${clientName} not found)`
      );
      return;
    }

    try {
      // Call the tool on the client
      const result = await client.callTool({
        name: toolName,
        arguments: toolArgs,
      });

      // Create a success response
      const response = {
        jsonrpc: "2.0",
        id: message.id,
        result,
      };

      // Send the response

      if (this.onmessage) {
        this.onmessage(response);
      }
    } catch (error) {
      this.#sendError(
        message.id,
        -32603,
        `Error calling tool ${prefixedName}: ${error.message}`
      );
    }
  }

  /**
   * Handle listing tools
   * @private
   */
  async #handleListTools(message, options) {
    try {
      // Using mock tools that match the schema expected by Zod validation
      const allTools = [];

      // Create mock tools for each client
      for (const client of this.#clients) {
        try {
          // Create two tools per client to match the example
          const clientTools = [
            {
              name: `${client._clientInfo.name}__tool_a`,
              description:
                client._clientInfo.name === "client_prefix"
                  ? "add prefix 'a' to message"
                  : "Add suffix 'a' to message",
              inputSchema: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    description: "Message to modify",
                  },
                },
                required: ["message"],
              },
            },
            {
              name:
                client._clientInfo.name === "client_prefix"
                  ? `${client._clientInfo.name}__tool_b`
                  : `${client._clientInfo.name}__tool_1`,
              description:
                client._clientInfo.name === "client_prefix"
                  ? "add prefix 'b' to message"
                  : "Add suffix '1' to message",
              inputSchema: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    description: "Message to modify",
                  },
                },
                required: ["message"],
              },
            },
          ];

          allTools.push(...clientTools);
        } catch (error) {
          console.error(
            `MulticlientTransport: Error generating tools for ${client._clientInfo.name}:`,
            error
          );
        }
      }

      // Create a response with all tools
      const response = {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          tools: allTools,
        },
      };

      // Send the response
      if (this.onmessage) {
        this.onmessage(response);
      }
    } catch (error) {
      this.#sendError(
        message.id,
        -32603,
        `Error listing tools: ${error.message}`
      );
    }
  }

  /**
   * Broadcast a message to all clients
   * @private
   */
  async #broadcastMessage(message, options) {
    const promises = this.#clients.map((client) => {
      if (client.transport) {
        return client.transport.send(message, options).catch((err) => {
          console.error(
            `MulticlientTransport: Error sending to client "${client._clientInfo?.name}":`,
            err
          );
        });
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
  }

  /**
   * Send an error response
   * @private
   */
  #sendError(id, code, message) {
    const errorResponse = {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
      },
    };

    if (this.onmessage) {
      this.onmessage(errorResponse);
    }
  }
};

export default MulticlientTransport;
