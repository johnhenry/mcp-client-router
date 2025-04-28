import { spawnExpressApp } from "../lib/spawn-express-app/index.mjs";
import process from "node:process";
import { createServerSuffix } from "./environment.mjs";
const PORT = process.env.PORT_FOR_SERVER;
const app = await spawnExpressApp(createServerSuffix());
// Start the server
export default await new Promise((resolve) => {
  const server = app.listen(PORT, () => {
    resolve(server.close.bind(server));
  });
});
