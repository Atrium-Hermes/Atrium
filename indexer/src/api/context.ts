import type { Address, PublicClient } from "viem";
import type { Db } from "../db/client.js";

export interface AppContext {
  db: Db;
  client: PublicClient;
  registry: Address;
}
