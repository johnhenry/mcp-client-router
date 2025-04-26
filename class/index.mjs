// index.mjs - Enhanced MCPMulticlient with API closer to Client and tool wrappers

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * MCPMulticlient - A class to manage connections to multiple MCP servers
 * with an API that closely resembles the standard Client
 * @example
 * const connector = new MCPMulticlient("MyClient", "1.0.0");
 * await connector.connect("./path/to/server1.js", { serverName: "serverName1" });
 * await connector.connect("http://localhost:3000/mcp", { serverName: "serverName2" });
 * const tools = await connector.getToolWrappers();
 * const result = await tools.myTool({ param1: "value1" });
 */
class MCPMulticlient {
  /**
   * Create a new MCPMulticlient
   * @param {string} clientName - Name of the client
   * @param {string} clientVersion - Version of the client
   * @param {object} [options] - Options for the connector
   * @param {boolean} [options.verbose=false] - Enable verbose logging
   */
  constructor({ name = "multi-client", version, verbose } = {}) {
    this.clientName = name;
    this.clientVersion = version;
    this.subclients = new Map();
    this.availableTools = [];
    this.verbose = verbose || false;
  }

  /**
   * Register new capabilities - dummy implementation that logs a warning
   * In a multiclient context, capabilities should be set during the client creation in connect()
   * @param {object} capabilities - Capabilities to register
   */
  registerCapabilities(capabilities) {
    console.warn(
      "registerCapabilities() is not supported in MCPMulticlient. " +
        "Capabilities are set automatically during connect(). " +
        "If you need custom capabilities, provide them in the constructor."
    );
    // No actual implementation as this doesn't make sense in a multiclient context
  }

  /**
   * Connect to an MCP server (API matches Client.connect)
   * @param {string|object} transportOrPath - Path to server executable, URL for HTTP servers, or a transport object
   * @param {object} [options={}] - Connection options
   * @param {string} [options.serverName] - Unique name for this server connection (generated if not provided)
   * @param {string[]} [options.args=[]] - Command line arguments for stdio servers
   * @param {Record<string, string>} [options.env={}] - Environment variables for stdio servers
   * @returns {Promise<{client: Client, serverName: string}>} The connected client and server name
   */
  async connect(transportOrPath, options = {}) {
    // Generate a unique server name if not provided
    const serverName =
      options.serverName ||
      `server_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    if (this.subclients.has(serverName)) {
      console.warn(
        `Client with name ${serverName} already exists. Returning existing client.`
      );
      return {
        client: this.subclients.get(serverName).client,
        serverName,
      };
    }

    // Create a new MCP client
    const client = new Client(
      {
        name: `${this.clientName}_${Date.now()}_${Math.floor(
          Math.random() * 1000
        )}`,
        version: this.clientVersion,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    let transport;

    // Handle different transport options
    if (typeof transportOrPath === "object") {
      // Direct transport object
      transport = transportOrPath;
    } else if (typeof transportOrPath === "string") {
      // String path or URL
      if (
        transportOrPath.startsWith("http://") ||
        transportOrPath.startsWith("https://")
      ) {
        // For HTTP-based servers, use the StreamableHTTPClientTransport
        transport = new StreamableHTTPClientTransport({
          url: new URL(transportOrPath),
        });
      } else {
        // For stdio-based servers
        transport = new StdioClientTransport({
          command: transportOrPath,
          args: options.args || [],
          env: options.env || {},
        });
      }
    } else {
      throw new Error(
        "Invalid transport: must be a transport object or a string path/URL"
      );
    }

    // Connect to the server
    try {
      if (this.verbose) {
        console.log(`Connecting to server: ${serverName}`);
      }
      await client.connect(transport);

      // Store the client for later use
      this.subclients.set(serverName, {
        client,
        transport,
        connected: true,
      });

      if (this.verbose) {
        console.log(`Successfully connected to MCP server: ${serverName}`);
      }
      return { client, serverName };
    } catch (error) {
      console.error(`Failed to connect to MCP server ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from a specific server
   * @param {string} serverName - Name of the server to disconnect from
   * @returns {Promise<boolean>} True if disconnected, false if client not found
   */
  async disconnectServer(serverName) {
    const clientInfo = this.subclients.get(serverName);
    if (!clientInfo || !clientInfo.connected) {
      return false;
    }

    try {
      await clientInfo.client.close();
      clientInfo.connected = false;

      if (this.verbose) {
        console.log(`Disconnected from MCP server: ${serverName}`);
      }

      return true;
    } catch (error) {
      console.error(
        `Error disconnecting from MCP server ${serverName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Disconnect from all servers
   * @returns {Promise<void>}
   */
  async disconnect() {
    const disconnectPromises = [];

    for (const [serverName] of this.subclients) {
      disconnectPromises.push(this.disconnectServer(serverName));
    }

    await Promise.allSettled(disconnectPromises);
    if (this.verbose) {
      console.log("Disconnected from all MCP servers");
    }
  }
  close() {
    return this.disconnect();
  }

  /**
   * Get a connected client by name
   * @param {string} serverName - Name of the server to get client for
   * @returns {Client|undefined} The client or undefined if not found
   */
  getClient(serverName) {
    const clientInfo = this.subclients.get(serverName);
    return clientInfo && clientInfo.connected ? clientInfo.client : undefined;
  }

  /**
   * Get all connected clients
   * @returns {Map<string, Client>} Map of all clients
   */
  getAllClients() {
    const connectedClients = new Map();

    for (const [serverName, clientInfo] of this.subclients.entries()) {
      if (clientInfo.connected) {
        connectedClients.set(serverName, clientInfo.client);
      }
    }

    return connectedClients;
  }
  /**
   * Get all connected server names
   * @returns {string[]} Array of connected server names
   */
  getAllServerNames() {
    const names = [];
    for (const [serverName, clientInfo] of this.subclients.entries()) {
      if (clientInfo.connected) {
        names.push(serverName);
      }
    }
    return names;
  }

  /**
   * Ping a specific server or all servers
   * @param {object} [options] - Request options
   * @param {string} [serverName] - Optional server name to restrict the operation to
   * @returns {Promise<object>} Ping results with server names as keys
   */
  async ping(options = {}, serverName) {
    const results = {};
    let pingErrors = false;

    // If serverName provided, only ping that specific server
    const serversToQuery = serverName
      ? [[serverName, this.subclients.get(serverName)]].filter(
          ([_, client]) => client
        )
      : Array.from(this.subclients.entries());

    if (serverName && serversToQuery.length === 0) {
      throw new Error(`Server not found or not connected: ${serverName}`);
    }

    for (const [sName, clientInfo] of serversToQuery) {
      if (!clientInfo.connected) {
        results[sName] = { success: false, error: "Not connected" };
        pingErrors = true;
        continue;
      }

      try {
        if (this.verbose) {
          console.log(`Pinging server: ${sName}`);
        }
        const result = await clientInfo.client.ping(options);
        results[sName] = { success: true, result };
      } catch (error) {
        results[sName] = { success: false, error: error.message };
        pingErrors = true;
        console.error(`Error pinging server ${sName}:`, error);
      }
    }

    // If only one server was requested, throw if it failed
    if (serverName && !results[serverName].success) {
      throw new Error(
        `Failed to ping server ${serverName}: ${results[serverName].error}`
      );
    }

    return {
      results,
      allSucceeded: !pingErrors,
    };
  }

  /**
   * Makes a completion request to a specific server
   * @param {object} params - Parameters for the completion request
   * @param {object} [options] - Request options
   * @param {string} [serverName] - Required server name to send the completion request to
   * @returns {Promise<object>} Completion result
   */
  async complete(params, options = {}, serverName) {
    if (!serverName) {
      throw new Error(
        "Server name is required for completion requests. " +
          "Completions must be directed to a specific server."
      );
    }

    const clientInfo = this.subclients.get(serverName);
    if (!clientInfo || !clientInfo.connected) {
      throw new Error(`Server not found or not connected: ${serverName}`);
    }

    try {
      if (this.verbose) {
        console.log(`Sending completion request to server: ${serverName}`);
      }
      const result = await clientInfo.client.complete(params, options);
      return result;
    } catch (error) {
      console.error(`Error in completion request to ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * Sets the logging level on a specific server or all servers
   * @param {string} level - Logging level to set
   * @param {object} [options] - Request options
   * @param {string} [serverName] - Optional server name to restrict the operation to
   * @returns {Promise<object>} Results with server names as keys
   */
  async setLoggingLevel(level, options = {}, serverName) {
    const results = {};
    let errors = false;

    // If serverName provided, only set level on that specific server
    const serversToQuery = serverName
      ? [[serverName, this.subclients.get(serverName)]].filter(
          ([_, client]) => client
        )
      : Array.from(this.subclients.entries());

    if (serverName && serversToQuery.length === 0) {
      throw new Error(`Server not found or not connected: ${serverName}`);
    }

    for (const [sName, clientInfo] of serversToQuery) {
      if (!clientInfo.connected) {
        results[sName] = { success: false, error: "Not connected" };
        errors = true;
        continue;
      }

      try {
        if (this.verbose) {
          console.log(`Setting logging level on server ${sName} to: ${level}`);
        }
        const result = await clientInfo.client.setLoggingLevel(level, options);
        results[sName] = { success: true, result };
      } catch (error) {
        results[sName] = { success: false, error: error.message };
        errors = true;
        console.error(`Error setting logging level on server ${sName}:`, error);
      }
    }

    // If only one server was requested, throw if it failed
    if (serverName && !results[serverName].success) {
      throw new Error(
        `Failed to set logging level on server ${serverName}: ${results[serverName].error}`
      );
    }

    return {
      results,
      allSucceeded: !errors,
    };
  }

  /**
   * Get server capabilities for a specific server
   * @param {string} serverName - Required server name to get capabilities for
   * @returns {object|undefined} Server capabilities or undefined if not found
   */
  getServerCapabilities(serverName) {
    if (!serverName) {
      throw new Error("Server name is required to get server capabilities");
    }

    const clientInfo = this.subclients.get(serverName);
    if (!clientInfo || !clientInfo.connected) {
      throw new Error(`Server not found or not connected: ${serverName}`);
    }

    return clientInfo.client.getServerCapabilities();
  }

  /**
   * Get server version information for a specific server
   * @param {string} serverName - Required server name to get version for
   * @returns {object|undefined} Server version info or undefined if not found
   */
  getServerVersion(serverName) {
    if (!serverName) {
      throw new Error("Server name is required to get server version");
    }

    const clientInfo = this.subclients.get(serverName);
    if (!clientInfo || !clientInfo.connected) {
      throw new Error(`Server not found or not connected: ${serverName}`);
    }

    return clientInfo.client.getServerVersion();
  }

  /**
   * Get server instructions for a specific server
   * @param {string} serverName - Required server name to get instructions for
   * @returns {string|undefined} Server instructions or undefined if not found
   */
  getInstructions(serverName) {
    if (!serverName) {
      throw new Error("Server name is required to get server instructions");
    }

    const clientInfo = this.subclients.get(serverName);
    if (!clientInfo || !clientInfo.connected) {
      throw new Error(`Server not found or not connected: ${serverName}`);
    }

    return clientInfo.client.getInstructions();
  }

  /**
   * Get a list of all available tools from all connected servers
   * @param {object} [params={}] - Optional parameters to pass to listTools
   * @param {string} [serverName] - Optional server name to restrict the operation to
   * @returns {Promise<{tools: Array<{name: string, description: string, client: Client, serverName: string}>}>}
   */
  async listTools(params = {}, serverName) {
    const tools = [];

    // If serverName provided, only query that specific server
    const serversToQuery = serverName
      ? [[serverName, this.subclients.get(serverName)]].filter(
          ([_, client]) => client
        )
      : Array.from(this.subclients.entries());

    if (serverName && serversToQuery.length === 0) {
      throw new Error(`Server not found or not connected: ${serverName}`);
    }

    for (const [sName, clientInfo] of serversToQuery) {
      if (!clientInfo.connected) {
        continue;
      }
      try {
        const response = await clientInfo.client.listTools(params);
        if (response.tools && Array.isArray(response.tools)) {
          for (const tool of response.tools) {
            tools.push({
              ...tool,
              client: clientInfo.client,
              serverName: sName,
            });
          }
        }
      } catch (error) {
        console.error(`Error listing tools for server ${sName}:`, error);
      }
    }

    return { tools };
  }

  /**
   * Call a specific tool by name
   * @param {object} options - Options for the callTool request
   * @param {string} options.name - Name of the tool to call
   * @param {object} [options.arguments={}] - Arguments to pass to the tool
   * @param {string} [serverName] - Optional server name to restrict the operation to
   * @returns {Promise<object>} Tool result
   */
  async callTool({ name, arguments: args = {} }, serverName) {
    // Find the tool
    let tools;

    if (serverName) {
      // Only search on the specified server
      tools = await this.listTools({}, serverName);
    } else {
      // Search across all servers
      tools = await this.listTools();
    }

    const tool = tools.tools.find((t) => t.name === name);
    if (!tool) {
      if (serverName) {
        throw new Error(`Tool "${name}" not found on server ${serverName}`);
      } else {
        throw new Error(`Tool "${name}" not found on any connected server`);
      }
    }

    try {
      if (this.verbose) {
        console.log(
          `Calling tool: ${name} on server: ${tool.serverName} with args:`,
          args
        );
      }
      const result = await tool.client.callTool({
        name,
        arguments: args,
      });
      if (this.verbose) {
        console.log(`Tool ${name} result:`, result);
      }
      return result;
    } catch (error) {
      console.error(`Error calling tool ${name}:`, error);
      throw error;
    }
  }

  /**
   * List all prompts from all connected servers
   * @param {object} [params={}] - Optional parameters to pass to listPrompts
   * @param {string} [serverName] - Optional server name to restrict the operation to
   * @returns {Promise<{prompts: Array<{id: string, title: string, client: Client, serverName: string}>}>}
   */
  async listPrompts(params = {}, serverName) {
    const prompts = [];

    // If serverName provided, only query that specific server
    const serversToQuery = serverName
      ? [[serverName, this.subclients.get(serverName)]].filter(
          ([_, client]) => client
        )
      : Array.from(this.subclients.entries());

    if (serverName && serversToQuery.length === 0) {
      throw new Error(`Server not found or not connected: ${serverName}`);
    }

    for (const [sName, clientInfo] of serversToQuery) {
      if (!clientInfo.connected) {
        continue;
      }
      try {
        const response = await clientInfo.client.listPrompts(params);
        if (response.prompts && Array.isArray(response.prompts)) {
          for (const prompt of response.prompts) {
            prompts.push({
              ...prompt,
              client: clientInfo.client,
              serverName: sName,
            });
          }
        }
      } catch (error) {
        console.error(`Error listing prompts for server ${sName}:`, error);
      }
    }

    return { prompts };
  }

  /**
   * Get a specific prompt by ID from any connected server
   * @param {object} params - Parameters for the getPrompt request
   * @param {string} params.id - ID of the prompt to get
   * @param {string} [serverName] - Optional server name to restrict the operation to
   * @returns {Promise<object>} The prompt content
   */
  async getPrompt(params, serverName) {
    if (!params || !params.id) {
      throw new Error("Prompt ID is required");
    }

    const promptId = params.id;

    // If serverName is provided, only search on that server
    let promptInfo;
    if (serverName) {
      const clientInfo = this.subclients.get(serverName);
      if (!clientInfo || !clientInfo.connected) {
        throw new Error(`Server not found or not connected: ${serverName}`);
      }

      // Find the prompt on the specified server
      const serverPrompts = await this.listPrompts({}, serverName);
      promptInfo = serverPrompts.prompts.find((p) => p.id === promptId);

      if (!promptInfo) {
        throw new Error(`Prompt ${promptId} not found on server ${serverName}`);
      }
    } else {
      // Search across all servers
      const prompts = await this.listPrompts();
      promptInfo = prompts.prompts.find((p) => p.id === promptId);

      if (!promptInfo) {
        throw new Error(`Prompt not found: ${promptId}`);
      }
    }

    try {
      if (this.verbose) {
        console.log(
          `Getting prompt: ${promptId} from server: ${promptInfo.serverName}`
        );
      }
      const result = await promptInfo.client.getPrompt({ id: promptId });
      return result;
    } catch (error) {
      console.error(`Error getting prompt ${promptId}:`, error);
      throw error;
    }
  }

  /**
   * List all resources from all connected servers
   * @param {object} [params={}] - Optional parameters to pass to listResources
   * @param {string} [serverName] - Optional server name to restrict the operation to
   * @returns {Promise<{resources: Array<{id: string, name: string, client: Client, serverName: string}>}>}
   */
  async listResources(params = {}, serverName) {
    const resources = [];

    // If serverName provided, only query that specific server
    const serversToQuery = serverName
      ? [[serverName, this.subclients.get(serverName)]].filter(
          ([_, client]) => client
        )
      : Array.from(this.subclients.entries());

    if (serverName && serversToQuery.length === 0) {
      throw new Error(`Server not found or not connected: ${serverName}`);
    }

    for (const [sName, clientInfo] of serversToQuery) {
      if (!clientInfo.connected) {
        continue;
      }
      try {
        const response = await clientInfo.client.listResources(params);
        if (response.resources && Array.isArray(response.resources)) {
          for (const resource of response.resources) {
            resources.push({
              ...resource,
              client: clientInfo.client,
              serverName: sName,
            });
          }
        }
      } catch (error) {
        console.error(`Error listing resources for server ${sName}:`, error);
      }
    }

    return { resources };
  }

  /**
   * List all resource templates from all connected servers
   * @param {object} [params={}] - Optional parameters to pass to listResourceTemplates
   * @param {string} [serverName] - Optional server name to restrict the operation to
   * @returns {Promise<{templates: Array<{id: string, name: string, client: Client, serverName: string}>}>}
   */
  async listResourceTemplates(params = {}, serverName) {
    const templates = [];

    // If serverName provided, only query that specific server
    const serversToQuery = serverName
      ? [[serverName, this.subclients.get(serverName)]].filter(
          ([_, client]) => client
        )
      : Array.from(this.subclients.entries());

    if (serverName && serversToQuery.length === 0) {
      throw new Error(`Server not found or not connected: ${serverName}`);
    }

    for (const [sName, clientInfo] of serversToQuery) {
      if (!clientInfo.connected) {
        continue;
      }
      try {
        const response = await clientInfo.client.listResourceTemplates(params);
        if (response.templates && Array.isArray(response.templates)) {
          for (const template of response.templates) {
            templates.push({
              ...template,
              client: clientInfo.client,
              serverName: sName,
            });
          }
        }
      } catch (error) {
        console.error(
          `Error listing resource templates for server ${sName}:`,
          error
        );
      }
    }

    return { templates };
  }

  /**
   * Read a specific resource by ID from any connected server
   * @param {object} params - Parameters for the readResource request
   * @param {string} params.id - ID of the resource to read
   * @param {string} [serverName] - Optional server name to restrict the operation to
   * @returns {Promise<object>} The resource content
   */
  async readResource(params, serverName) {
    if (!params || !params.id) {
      throw new Error("Resource ID is required");
    }

    const resourceId = params.id;

    // If serverName is provided, only search on that server
    let resourceInfo;
    if (serverName) {
      const clientInfo = this.subclients.get(serverName);
      if (!clientInfo || !clientInfo.connected) {
        throw new Error(`Server not found or not connected: ${serverName}`);
      }

      // Find the resource on the specified server
      const serverResources = await this.listResources({}, serverName);
      resourceInfo = serverResources.resources.find((r) => r.id === resourceId);

      if (!resourceInfo) {
        throw new Error(
          `Resource ${resourceId} not found on server ${serverName}`
        );
      }
    } else {
      // Search across all servers
      const resources = await this.listResources();
      resourceInfo = resources.resources.find((r) => r.id === resourceId);

      if (!resourceInfo) {
        throw new Error(`Resource not found: ${resourceId}`);
      }
    }

    try {
      if (this.verbose) {
        console.log(
          `Reading resource: ${resourceId} from server: ${resourceInfo.serverName}`
        );
      }
      const result = await resourceInfo.client.readResource({ id: resourceId });
      return result;
    } catch (error) {
      console.error(`Error reading resource ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to a resource updates
   * @param {object} params - Parameters for the subscribeResource request
   * @param {string} params.id - ID of the resource to subscribe to
   * @param {string} [serverName] - Optional server name to restrict the operation to
   * @returns {Promise<object>} Subscription result
   */
  async subscribeResource(params, serverName) {
    if (!params || !params.id) {
      throw new Error("Resource ID is required for subscription");
    }

    const resourceId = params.id;

    // If serverName is provided, only search on that server
    let resourceInfo;
    if (serverName) {
      const clientInfo = this.subclients.get(serverName);
      if (!clientInfo || !clientInfo.connected) {
        throw new Error(`Server not found or not connected: ${serverName}`);
      }

      // Find the resource on the specified server
      const serverResources = await this.listResources({}, serverName);
      resourceInfo = serverResources.resources.find((r) => r.id === resourceId);

      if (!resourceInfo) {
        throw new Error(
          `Resource ${resourceId} not found on server ${serverName}`
        );
      }
    } else {
      // Search across all servers
      const resources = await this.listResources();
      resourceInfo = resources.resources.find((r) => r.id === resourceId);

      if (!resourceInfo) {
        throw new Error(`Resource not found for subscription: ${resourceId}`);
      }
    }

    try {
      if (this.verbose) {
        console.log(
          `Subscribing to resource: ${resourceId} on server: ${resourceInfo.serverName}`
        );
      }
      const result = await resourceInfo.client.subscribeResource({
        id: resourceId,
      });
      return result;
    } catch (error) {
      console.error(`Error subscribing to resource ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from a resource
   * @param {object} params - Parameters for the unsubscribeResource request
   * @param {string} params.id - ID of the resource to unsubscribe from
   * @param {string} [serverName] - Optional server name to restrict the operation to
   * @returns {Promise<object>} Unsubscription result
   */
  async unsubscribeResource(params, serverName) {
    if (!params || !params.id) {
      throw new Error("Resource ID is required for unsubscription");
    }

    const resourceId = params.id;

    // If serverName is provided, only search on that server
    let resourceInfo;
    if (serverName) {
      const clientInfo = this.subclients.get(serverName);
      if (!clientInfo || !clientInfo.connected) {
        throw new Error(`Server not found or not connected: ${serverName}`);
      }

      // Find the resource on the specified server
      const serverResources = await this.listResources({}, serverName);
      resourceInfo = serverResources.resources.find((r) => r.id === resourceId);

      if (!resourceInfo) {
        throw new Error(
          `Resource ${resourceId} not found on server ${serverName}`
        );
      }
    } else {
      // Search across all servers
      const resources = await this.listResources();
      resourceInfo = resources.resources.find((r) => r.id === resourceId);

      if (!resourceInfo) {
        throw new Error(`Resource not found for unsubscription: ${resourceId}`);
      }
    }

    try {
      if (this.verbose) {
        console.log(
          `Unsubscribing from resource: ${resourceId} on server: ${resourceInfo.serverName}`
        );
      }
      const result = await resourceInfo.client.unsubscribeResource({
        id: resourceId,
      });
      return result;
    } catch (error) {
      console.error(`Error unsubscribing from resource ${resourceId}:`, error);
      throw error;
    }
  }
}

export { MCPMulticlient };
export default MCPMulticlient;
