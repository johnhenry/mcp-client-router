/**
 * ClientRouter exposes multiple clients as a single transport.
 * It follows the Transport interface from the Model Context Protocol
 * @implements {Transport} // https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/src/shared/transport.ts
 * @param {Array} clients - The clients to be used in the transport.
 */
const ClientRouter = class {
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

      if (
        message.method === "list_prompts" ||
        message.method === "prompts/list"
      ) {
        return this.#handleListPrompts(message, options);
      }

      if (message.method === "get_prompt" || message.method === "prompts/get") {
        return this.#handleGetPrompt(message, options);
      }

      if (
        message.method === "list_resources" ||
        message.method === "resources/list"
      ) {
        return this.#handleListResources(message, options);
      }

      if (
        message.method === "read_resource" ||
        message.method === "resources/read"
      ) {
        return this.#handleReadResource(message, options);
      }

      // For other messages, broadcast to all clients
      return this.#broadcastMessage(message, options);
    } catch (error) {
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
    for (const client of this.#clients) {
      try {
        await client.close();
      } catch (error) {
        throw new Error(
          `Error closing client ${client._clientInfo?.name}: ${error}`
        );
      }
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
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {
            supports_list: true,
            supports_info: true,
            supports_execute: true,
            supports_list_changes: true,
          },
          resources: {
            supports_list: true,
            supports_read: true,
            supports_list_changes: true,
          },
          prompts: {
            supports_list: true,
            supports_get: true,
            supports_list_changes: true,
          },
        },
        serverInfo: {
          name: "ClientRouter",
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
      const allTools = [];

      // Get tools from each client and prefix them
      for (const client of this.#clients) {
        try {
          // Attempt to list tools from this client
          const result = await client.listTools();

          if (result && result.tools && Array.isArray(result.tools)) {
            // Prefix each tool name with the client name
            const prefixedTools = result.tools.map((tool) => ({
              ...tool,
              name: `${client._clientInfo.name}__${tool.name}`,
            }));

            allTools.push(...prefixedTools);
          }
        } catch (error) {
          throw new Error(
            `ClientRouter: Error getting tools from ${client._clientInfo?.name}:${error}`
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
   * Handle listing prompts
   * @private
   */
  async #handleListPrompts(message, options) {
    try {
      const allPrompts = [];

      // Get prompts from each client and prefix them
      for (const client of this.#clients) {
        try {
          // Attempt to list prompts from this client
          const result = await client.listPrompts();

          if (result && result.prompts && Array.isArray(result.prompts)) {
            // Prefix each prompt name with the client name
            const prefixedPrompts = result.prompts.map((prompt) => ({
              ...prompt,
              name: `${client._clientInfo.name}__${prompt.name}`,
            }));

            allPrompts.push(...prefixedPrompts);
          }
        } catch (error) {
          throw new Error(
            `ClientRouter: Error getting prompts from ${client._clientInfo?.name}:${error}`
          );
        }
      }

      // Create a response with all prompts
      const response = {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          prompts: allPrompts,
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
        `Error listing prompts: ${error.message}`
      );
    }
  }

  /**
   * Handle getting a prompt
   * @private
   */
  async #handleGetPrompt(message, options) {
    try {
      // Get the prompt name from the request
      let promptName = message.params?.name;

      if (!promptName) {
        // Try to find name in params.arguments if it wasn't directly in params
        if (message.params?.arguments?.name) {
          promptName = message.params.arguments.name;
        }
      }

      if (!promptName) {
        this.#sendError(message.id, -32602, "Missing prompt name");
        return;
      }

      // Parse the prompt name to get client name and actual prompt name
      const parts = promptName.split("__");

      if (parts.length < 2) {
        this.#sendError(message.id, -32602, `Prompt ${promptName} not found`);
        return;
      }

      const clientName = parts[0];
      const actualPromptName = parts.slice(1).join("__");

      // Find the client by name
      const client = this.#clients.find(
        (c) => c._clientInfo?.name === clientName
      );

      if (!client) {
        this.#sendError(
          message.id,
          -32602,
          `Prompt ${promptName} not found (client ${clientName} not found)`
        );
        return;
      }

      try {
        // Prepare the arguments for the prompt
        const promptArguments = message.params.arguments || {};
        // Call the client with properly formatted arguments
        const result = await client.getPrompt({
          name: actualPromptName,
          arguments: promptArguments,
        });

        // Prefix the prompt name in the result
        if (result && result.prompt) {
          result.prompt.name = `${clientName}__${result.prompt.name}`;
        }

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
          `Error getting prompt ${promptName}: ${error.message}`
        );
      }
    } catch (error) {
      this.#sendError(
        message.id,
        -32603,
        `Error processing get_prompt request: ${error.message}`
      );
    }
  }

  /**
   * Handle listing resources
   * @private
   */
  async #handleListResources(message, options) {
    try {
      const allResources = [];

      // Get resources from each client and prefix them
      for (const client of this.#clients) {
        try {
          // Attempt to list resources from this client
          const result = await client.listResources();

          if (result && result.resources && Array.isArray(result.resources)) {
            // Prefix each resource URI with the client name
            const prefixedResources = result.resources.map((resource) => {
              const prefixedResource = { ...resource };

              if (resource.uri) {
                prefixedResource.uri = `${client._clientInfo.name}__${resource.uri}`;
              }

              return prefixedResource;
            });

            allResources.push(...prefixedResources);
          } else {
          }
        } catch (error) {
          throw new Error(
            `Error listing resources from ${client._clientInfo?.name}:${error}`
          );
        }
      }

      // Create a response with all resources
      const response = {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          resources: allResources,
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
        `Error listing resources: ${error.message}`
      );
    }
  }

  /**
   * Handle reading a resource
   * @private
   */
  async #handleReadResource(message, options) {
    try {
      // Get the resource URI from the request
      let resourceUri = message.params?.uri;
      if (!resourceUri) {
        // Try to find uri in params.arguments if it wasn't directly in params
        if (message.params?.arguments?.uri) {
          resourceUri = message.params.arguments.uri;
        }
      }

      if (!resourceUri) {
        this.#sendError(message.id, -32602, "Missing resource URI");
        return;
      }

      let clientName, actualUri;

      // Use a simple approach: split by double underscore
      const parts = resourceUri.split("__");

      if (parts.length < 2) {
        this.#sendError(
          message.id,
          -32602,
          `Resource ${resourceUri} not found: missing client prefix`
        );
        return;
      }

      clientName = parts[0];
      actualUri = parts.slice(1).join("__");

      // Find the client by name
      const client = this.#clients.find(
        (c) => c._clientInfo?.name === clientName
      );

      if (!client) {
        this.#sendError(
          message.id,
          -32602,
          `Resource ${resourceUri} not found (client ${clientName} not found)`
        );
        return;
      }

      try {
        // Read the resource from the client
        const result = await client.readResource({ uri: actualUri });

        // Prefix any URIs in the resource contents
        if (result && result.contents && Array.isArray(result.contents)) {
          result.contents.forEach((content) => {
            if (content.uri) {
              // Use the simpler consistent approach - always prefix with client__
              const originalUri = content.uri;
              content.uri = `${clientName}__${content.uri}`;
            }
          });
        }

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
          `Error reading resource ${resourceUri}: ${error.message}`
        );
      }
    } catch (error) {
      this.#sendError(
        message.id,
        -32603,
        `Error processing read_resource request: ${error.message}`
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
        return client.transport.send(message, options).catch((error) => {
          throw new Error(
            `ClientRouter: Error sending to client "${client._clientInfo?.name}":${error}`
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
/**
 * Connects the router to a Server Transport, making the router behave like an MCP server
 * @param {Transport|Function} transportOrConstructor - The transport instance or constructor function
 * @param {Object} options - Options to pass to the transport constructor if a constructor is provided
 * @returns {Transport} The connected transport instance
 */
ClientRouter.prototype.connect = async function (
  transportOrConstructor,
  options = {}
) {
  // If a constructor function is provided, instantiate it
  let transport =
    typeof transportOrConstructor === "function"
      ? new transportOrConstructor(options)
      : transportOrConstructor;

  // Store a reference to the transport
  this.serverTransport = transport;

  // Set up event handlers
  transport.onmessage = (message) => {
    // When the transport receives a message, forward it to our send method
    this.send(message).catch((error) => {
      if (this.onerror) {
        this.onerror(error);
      }
    });
  };

  transport.onerror = (error) => {
    if (this.onerror) {
      this.onerror(error);
    }
  };

  transport.onclose = () => {
    if (this.onclose) {
      this.onclose();
    }
  };

  // Set our onmessage handler to forward responses back to the transport
  this.onmessage = (response) => {
    transport.send(response).catch((error) => {
      if (this.onerror) {
        this.onerror(error);
      }
    });
  };

  // Start the transport
  await transport.start();

  return transport;
};

export { ClientRouter };
export default ClientRouter;
