// Seeds the demo SQLite DB with sample skills so the frontend has content to show.
// Run from the indexer/ dir: node seed-demo.mjs
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";

const db = new Database("./atrium-demo.db");
db.exec(readFileSync("./src/db/schema.sql", "utf-8"));

// wipe prior demo rows
for (const t of ["skills", "skill_parents", "invocations", "royalty_payments", "attestations", "skills_fts"]) {
  db.prepare(`DELETE FROM ${t}`).run();
}

const now = Math.floor(Date.now() / 1000);
const alice = "0xa11ce0000000000000000000000000000000a11c";
const bob = "0xb0b0000000000000000000000000000000000b0b";

const skills = [
  {
    id: "0x1111111111111111111111111111111111111111111111111111111111111111",
    creator: alice, name: "pdf-table-extractor",
    desc: "Extracts tabular data from PDFs with mixed text and scanned content. Handles multi-page tables, irregular cells, and merged cells; returns normalized JSON.",
    tags: ["pdf", "extraction", "tables", "ocr"], cats: ["document-processing"],
    price: "5000", inv: 1284, vol: "6420000", earned: "6259500", created: now - 86400 * 12,
    body: "# pdf-table-extractor\n\nExtract clean tabular data from messy PDFs.\n\n## Inputs\n- `pdf_url` — HTTPS or IPFS URI\n- `page_range` — e.g. `1-5` or `all`\n\n## Approach\n1. Detect table regions per page\n2. Normalize rows/columns, merge split cells\n3. Emit JSON `{ page, rows[] }`\n\n```json\n{ \"tables\": [{ \"page\": 1, \"rows\": [[\"A\",\"B\"],[\"1\",\"2\"]] }] }\n```",
  },
  {
    id: "0x2222222222222222222222222222222222222222222222222222222222222222",
    creator: bob, name: "typescript-refactor-helper",
    desc: "Suggests safe, incremental refactors for a TypeScript codebase: extracts functions, tightens types, and removes dead code while preserving behavior.",
    tags: ["typescript", "refactor", "codegen"], cats: ["developer-tools"],
    price: "2500", inv: 642, vol: "1605000", earned: "1564875", created: now - 86400 * 5,
    body: "# typescript-refactor-helper\n\nIncremental, behavior-preserving refactors.\n\n- Extract long functions (>50 lines)\n- Replace `any` with inferred types\n- Flag unused exports\n\n> Derived from a Hermes closed-loop session.",
  },
  {
    id: "0x3333333333333333333333333333333333333333333333333333333333333333",
    creator: alice, name: "sql-query-optimizer",
    desc: "Rewrites slow SQL into index-friendly form and explains the plan changes. Targets Postgres and SQLite dialects.",
    tags: ["sql", "performance", "postgres"], cats: ["data"],
    price: "3000", inv: 173, vol: "519000", earned: "506025", created: now - 86400 * 2,
    body: "# sql-query-optimizer\n\nMake slow queries fast.\n\n## What it does\n- Pushes predicates, removes correlated subqueries\n- Suggests covering indexes\n- Shows before/after `EXPLAIN`",
  },
  {
    id: "0x4444444444444444444444444444444444444444444444444444444444444444",
    creator: bob, name: "pdf-invoice-parser",
    desc: "Derived from pdf-table-extractor — specialized for invoices. Pulls line items, totals, tax, and vendor metadata into a typed schema.",
    tags: ["pdf", "invoice", "finance"], cats: ["document-processing"],
    price: "8000", inv: 58, vol: "464000", earned: "394400", created: now - 86400 * 1,
    body: "# pdf-invoice-parser\n\nInvoice-specific extraction built on `pdf-table-extractor`.\n\nReturns `{ vendor, lineItems[], subtotal, tax, total }`.",
  },
];

const ins = db.prepare(`INSERT INTO skills
 (skillId,cid,creator,didHash,pricePerCall,totalInvocations,totalVolume,totalEarned,active,createdAt,lastInvoked,blockNumber,name,description,tagsJson,categoriesJson,tagsText,categoriesText,manifestJson,body,ipfsFetched)
 VALUES (@id,@cid,@creator,@did,@price,@inv,@vol,@earned,1,@created,@last,@block,@name,@desc,@tagsJson,@catsJson,@tagsText,@catsText,@manifest,@body,1)`);
const insFts = db.prepare("INSERT INTO skills_fts (skillId,name,description,tags,body) VALUES (?,?,?,?,?)");

for (let i = 0; i < skills.length; i++) {
  const s = skills[i];
  ins.run({
    id: s.id, cid: `bafyDemo${i}`, creator: s.creator, did: `0xdid${i}`,
    price: s.price, inv: s.inv, vol: s.vol, earned: s.earned,
    created: s.created, last: s.created + 3600, block: 1000 + i,
    name: s.name, desc: s.desc,
    tagsJson: JSON.stringify(s.tags), catsJson: JSON.stringify(s.cats),
    tagsText: s.tags.join(" "), catsText: s.cats.join(" "),
    manifest: JSON.stringify({ name: s.name, version: "0.1.0", price_per_call_usdc: (Number(s.price) / 1e6).toString() }),
    body: s.body,
  });
  insFts.run(s.id, s.name, s.desc, s.tags.join(" "), s.body);
  // a few recent invocations each
  for (let k = 0; k < 4; k++) {
    db.prepare(`INSERT OR IGNORE INTO invocations (txHash,logIndex,skillId,caller,amount,invocationNumber,blockNumber,blockTimestamp)
      VALUES (?,?,?,?,?,?,?,?)`).run(`0xtx${i}${k}`, k, s.id, "0xca11e7000000000000000000000000000000ca11", s.price, s.inv - k, 1000 + i, s.created + k * 600);
  }
}

// pdf-invoice-parser derives from pdf-table-extractor (15% royalty)
db.prepare("INSERT OR IGNORE INTO skill_parents (skillId,parentSkillId,royaltyBps) VALUES (?,?,?)")
  .run(skills[3].id, skills[0].id, 1500);

// attestation on the top skill
db.prepare(`INSERT OR REPLACE INTO attestations (skillId,benchmarkHash,successRate,sampleCount,attester,attestedAt,txHash)
 VALUES (?,?,?,?,?,?,?)`).run(skills[0].id, "0xbenchmarkhash", 9650, 200, alice, now - 86400 * 10, "0xattesttx");

db.prepare("INSERT OR REPLACE INTO events_cursor (name,lastBlock) VALUES ('registry', 999999998)").run();
db.close();
console.log(`Seeded ${skills.length} skills into ./atrium-demo.db`);
