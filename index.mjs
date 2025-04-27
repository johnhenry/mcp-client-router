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
      console.error("Error in ClientRouter.send:", error);

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
          resources: true,
          prompts: true,
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
          console.error(
            `ClientRouter: Error getting tools from ${client._clientInfo?.name}:`,
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
          console.error(
            `ClientRouter: Error getting prompts from ${client._clientInfo?.name}:`,
            error
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
        console.log(
          `Calling getPrompt for ${actualPromptName}`,
          promptArguments
        );
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
      console.log("Starting to list resources from all clients");

      // Get resources from each client and prefix them
      for (const client of this.#clients) {
        try {
          console.log(
            `Listing resources from client: ${client._clientInfo?.name}`
          );
          // Attempt to list resources from this client
          const result = await client.listResources();
          console.log(
            `Got resources from ${client._clientInfo?.name}:`,
            JSON.stringify(result)
          );

          if (result && result.resources && Array.isArray(result.resources)) {
            console.log(`Found ${result.resources.length} resources`);

            // Prefix each resource URI with the client name
            const prefixedResources = result.resources.map((resource) => {
              const prefixedResource = { ...resource };

              if (resource.uri) {
                prefixedResource.uri = `${client._clientInfo.name}__${resource.uri}`;
                console.log(`Created prefixed URI: ${prefixedResource.uri}`);
              }

              return prefixedResource;
            });

            allResources.push(...prefixedResources);
          } else {
            console.log(
              `No resources found for client ${client._clientInfo?.name}`
            );
          }
        } catch (error) {
          console.error(
            `Error listing resources from ${client._clientInfo?.name}:`,
            error
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

      console.log(
        `Sending response with ${allResources.length} total resources`
      );

      // Send the response
      if (this.onmessage) {
        this.onmessage(response);
      }
    } catch (error) {
      console.error(`Error in #handleListResources:`, error);
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
      console.log(`Reading resource: ${resourceUri}`);

      if (!resourceUri) {
        // Try to find uri in params.arguments if it wasn't directly in params
        if (message.params?.arguments?.uri) {
          resourceUri = message.params.arguments.uri;
          console.log(`Found URI in arguments: ${resourceUri}`);
        }
      }

      if (!resourceUri) {
        this.#sendError(message.id, -32602, "Missing resource URI");
        return;
      }

      let clientName, actualUri;

      // Use a simple approach: split by double underscore
      const parts = resourceUri.split("__");
      console.log(`Split URI into parts: ${JSON.stringify(parts)}`);

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
      console.log(`Client name: ${clientName}, Actual URI: ${actualUri}`);

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
        console.log(`Reading resource from client ${clientName}`);
        // Read the resource from the client
        const result = await client.readResource({ uri: actualUri });
        console.log(`Got resource result:`, JSON.stringify(result));

        // Prefix any URIs in the resource contents
        if (result && result.contents && Array.isArray(result.contents)) {
          result.contents.forEach((content) => {
            if (content.uri) {
              // Use the simpler consistent approach - always prefix with client__
              const originalUri = content.uri;
              content.uri = `${clientName}__${content.uri}`;
              console.log(
                `Prefixed content URI: ${originalUri} -> ${content.uri}`
              );
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
        console.error(
          `Error reading resource ${actualUri} from client ${clientName}:`,
          error
        );
        this.#sendError(
          message.id,
          -32603,
          `Error reading resource ${resourceUri}: ${error.message}`
        );
      }
    } catch (error) {
      console.error(`Error in #handleReadResource:`, error);
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
        return client.transport.send(message, options).catch((err) => {
          console.error(
            `ClientRouter: Error sending to client "${client._clientInfo?.name}":`,
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
export { ClientRouter };
export default ClientRouter;
