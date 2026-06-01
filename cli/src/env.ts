// Loads ~/.atrium/.env at import time. This module MUST be imported FIRST in
// index.ts: ESM evaluates imports in source order, so importing it before the
// command modules guarantees process.env is populated before shared/schema.ts's
// NETWORKS (which reads ATRIUM_REGISTRY_* at module-eval time) is evaluated.
import { config } from "dotenv";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";

const envPath = join(homedir(), ".atrium", ".env");
if (existsSync(envPath)) config({ path: envPath });
