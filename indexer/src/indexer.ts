import type { PublicClient, Address, Log } from "viem";
import type { Db } from "./db/client.js";
import type { IpfsFetcher } from "./ipfs/fetcher.js";
import type { Logger } from "./lib/logger.js";
import type { Config } from "./lib/config.js";
import { REGISTRY_ABI, REGISTRY_EVENTS } from "./lib/chain.js";
import type { EventMeta } from "./handlers/types.js";
import { handleSkillRegistered, handleSkillDeactivated } from "./handlers/skill.js";
import { handleSkillInvoked, handleRoyaltyPaid, handleWithdraw } from "./handlers/invocation.js";
import { handleBenchmarkAttested } from "./handlers/attestation.js";

const CURSOR = "registry";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type DecodedLog = Log<bigint, number, false> & { eventName: string; args: Record<string, unknown> };

export class Indexer {
  private feeBps = 250; // sane default; refreshed from chain on start
  private stopped = false;
  lastIndexedAt = 0;

  constructor(
    private db: Db,
    private client: PublicClient,
    private fetcher: IpfsFetcher,
    private cfg: Config,
    private log: Logger
  ) {}

  lastBlock(): bigint {
    return this.db.getCursor(CURSOR) ?? 0n;
  }

  async start(): Promise<void> {
    if (this.db.getCursor(CURSOR) === null) {
      const init = this.cfg.deployBlock > 0n ? this.cfg.deployBlock - 1n : 0n;
      this.db.setCursor(CURSOR, init);
      this.log.info({ from: (init + 1n).toString() }, "initialized cursor");
    }
    await this.refreshFee();
    const requeued = this.fetcher.backfillUnfetched();
    if (requeued) this.log.info({ requeued }, "re-enqueued uncached skill bodies");
    void this.run();
  }

  stop(): void {
    this.stopped = true;
  }

  private async run(): Promise<void> {
    let backoff = 1000;
    while (!this.stopped) {
      try {
        await this.tick();
        backoff = 1000;
        await sleep(this.cfg.pollIntervalMs);
      } catch (err) {
        this.log.error({ err, backoff }, "indexer tick failed; backing off");
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 60_000);
      }
    }
  }

  private async tick(): Promise<void> {
    const latest = await this.client.getBlockNumber();
    let from = this.lastBlock() + 1n;
    while (from <= latest && !this.stopped) {
      const to = from + this.cfg.maxBlockRange - 1n > latest ? latest : from + this.cfg.maxBlockRange - 1n;
      await this.processWindow(from, to);
      from = to + 1n;
    }
    this.lastIndexedAt = Date.now();
  }

  private async processWindow(from: bigint, to: bigint): Promise<void> {
    const logs = (await this.client.getLogs({
      address: this.cfg.registry as Address,
      events: REGISTRY_EVENTS,
      fromBlock: from,
      toBlock: to,
    })) as unknown as DecodedLog[];

    logs.sort((a, b) =>
      a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : Number(a.blockNumber - b.blockNumber)
    );

    const timestamps = await this.blockTimestamps(logs);
    const newCids: Array<{ skillId: string; cid: string }> = [];

    this.db.tx(() => {
      for (const lg of logs) this.dispatch(lg, timestamps, newCids);
      this.db.setCursor(CURSOR, to);
    });

    for (const c of newCids) this.fetcher.schedule(c.skillId, c.cid);
    if (logs.length) this.log.info({ from: from.toString(), to: to.toString(), events: logs.length }, "indexed window");
  }

  private dispatch(
    lg: DecodedLog,
    timestamps: Map<bigint, number>,
    newCids: Array<{ skillId: string; cid: string }>
  ): void {
    const m: EventMeta = {
      txHash: lg.transactionHash ?? "",
      logIndex: lg.logIndex ?? 0,
      blockNumber: lg.blockNumber ?? 0n,
      blockTimestamp: timestamps.get(lg.blockNumber ?? 0n) ?? 0,
    };
    // viem decodes event args into a per-event dynamic shape; this is external
    // data the handlers validate by field access, so a single annotated cast is used.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = lg.args as any;

    switch (lg.eventName) {
      case "SkillRegistered": {
        const cid = handleSkillRegistered(this.db, a, m);
        if (cid) newCids.push({ skillId: a.skillId, cid });
        break;
      }
      case "SkillDeactivated":
        handleSkillDeactivated(this.db, a);
        break;
      case "SkillInvoked":
        handleSkillInvoked(this.db, a, m, this.feeBps);
        break;
      case "RoyaltyPaid":
        handleRoyaltyPaid(this.db, a, m);
        break;
      case "Withdraw":
        handleWithdraw(this.db, a, m);
        break;
      case "BenchmarkAttested":
        handleBenchmarkAttested(this.db, a, m);
        break;
      case "ProtocolFeeUpdated":
        this.feeBps = Number((a as { newFee: number }).newFee);
        this.db.setMeta("protocolFeeBps", String(this.feeBps));
        break;
    }
  }

  private async blockTimestamps(logs: DecodedLog[]): Promise<Map<bigint, number>> {
    const unique = [...new Set(logs.map((l) => l.blockNumber ?? 0n))];
    const out = new Map<bigint, number>();
    await Promise.all(
      unique.map(async (bn) => {
        const block = await this.client.getBlock({ blockNumber: bn });
        out.set(bn, Number(block.timestamp));
      })
    );
    return out;
  }

  private async refreshFee(): Promise<void> {
    try {
      const fee = (await this.client.readContract({
        address: this.cfg.registry as Address,
        abi: REGISTRY_ABI,
        functionName: "protocolFeeBps",
      })) as number;
      this.feeBps = Number(fee);
      this.db.setMeta("protocolFeeBps", String(this.feeBps));
    } catch {
      const cached = this.db.getMeta("protocolFeeBps");
      if (cached) this.feeBps = Number(cached);
      this.log.warn({ feeBps: this.feeBps }, "could not read protocolFeeBps; using cached/default");
    }
  }
}
