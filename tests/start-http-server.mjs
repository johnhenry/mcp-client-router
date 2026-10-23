import process from "node:process";
import createExpressApp from "@johnhenry/mcp-create-express-app";
import { createServerSuffix } from "./environment.mjs";
const PORT = process.env.PORT_FOR_SERVER ?? "18734";
const app = await createExpressApp(createServerSuffix());
// Start the server
export default await new Promise((resolve) => {
  const server = app.listen(PORT, () => {
    resolve(server.close.bind(server));
  });
});
