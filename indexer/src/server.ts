import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { makeClient } from "./lib/chain.js";
import { Db } from "./db/client.js";
import { IpfsFetcher } from "./ipfs/fetcher.js";
import { Indexer } from "./indexer.js";
import type { AppContext } from "./api/context.js";
import { searchRoutes } from "./api/search.js";
import { skillRoutes } from "./api/skill.js";
import { creatorRoutes } from "./api/creator.js";
import { statsRoutes } from "./api/stats.js";
import { recentRoutes } from "./api/recent.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const log = logger;
  log.info({ registry: cfg.registry, db: cfg.databasePath }, "starting atrium indexer");

  const db = new Db(cfg.databasePath);
  const client = makeClient(cfg.rpcUrl);
  const fetcher = new IpfsFetcher(db, cfg.ipfsGateways, cfg.ipfsConcurrency, log);
  const indexer = new Indexer(db, client, fetcher, cfg, log);

  const ctx: AppContext = { db, client, registry: cfg.registry };
  const app = new Hono();
  app.use("*", cors()); // open CORS for now; lock down at production

  app.get("/health", (c) =>
    c.json({
      ok: true,
      lastBlock: indexer.lastBlock().toString(),
      lastIndexedAt: indexer.lastIndexedAt || null,
    })
  );

  searchRoutes(app, ctx);
  skillRoutes(app, ctx);
  creatorRoutes(app, ctx);
  statsRoutes(app, ctx);
  recentRoutes(app, ctx);

  // Start indexing loop and HTTP server in the same process.
  await indexer.start();
  const server = serve({ fetch: app.fetch, port: cfg.port }, (info) =>
    log.info({ port: info.port }, "api listening")
  );

  const shutdown = () => {
    log.info("shutting down");
    indexer.stop();
    server.close();
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error({ err }, "fatal: indexer failed to start");
  process.exit(1);
});
