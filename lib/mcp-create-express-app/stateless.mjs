import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const handlers = (server) => {
  const handleRequest = async (req, res) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        transport.close();
        server.close();
      });
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  };
  const handleSessionRequest = async (req, res) => {
    res.writeHead(405).end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed.",
        },
        id: null,
      })
    );
  };
  const handleSessionDelete = async (req, res) => {
    res.writeHead(405).end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed.",
        },
        id: null,
      })
    );
  };
  return {
    handleRequest,
    handleSessionRequest,
    handleSessionDelete,
  };
};

const createStateless = async (server, { path = "/" } = { path: "/" }) => {
  const app = express();
  app.use(express.json());
  const { handleRequest, handleSessionRequest, handleSessionDelete } =
    handlers(server);
  app.post(path, handleRequest);
  app.get(path, handleSessionRequest);
  app.delete(path, handleSessionDelete);
  return app;
};
export { createStateless };
export default createStateless;
