import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

const handlers = (server, transports = {}) => {
  const handleRequest = async (req, res) => {
    // Check for existing session ID
    const sessionId = req.headers["mcp-session-id"];
    let transport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID
          transports[sessionId] = transport;
        },
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };
      // Connect to the MCP server
      await server.connect(transport);
    } else {
      // Invalid request
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }
    // Handle the request
    await transport.handleRequest(req, res, req.body);
  };
  const handleSessionRequest = async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  };
  return {
    handleRequest,
    handleSessionRequest,
    handleSessionDelete: handleSessionRequest,
  };
};

const createStateful = async (
  server,
  { path = "/", transports = {} } = { path: "", transports: {} }
) => {
  const app = express();
  app.use(express.json());
  const { handleRequest, handleSessionRequest, handleSessionDelete } = handlers(
    server,
    transports
  );
  app.post(path, handleRequest);
  app.get(path, handleSessionRequest);
  app.delete(path, handleSessionDelete);
  return app;
};
export { createStateful };
export default createStateful;
