import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServerPrefix } from "./environment.mjs";
await (await createServerPrefix()).connect(new StdioServerTransport());
