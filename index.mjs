/**
 * MulticlientTransport is a class that allows for the creation of multiple clients AND properly prefixes names of tool
 * @implements {Transport} // https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/src/shared/transport.ts
 * @param {Array} clients - The clients to be used in the transport.
 */
export const MulticlientTransport = class {
  #clients = [];
  constructor(clients = []) {
    this.#clients.push(...clients);
  }
};

export default MulticlientTransport;
