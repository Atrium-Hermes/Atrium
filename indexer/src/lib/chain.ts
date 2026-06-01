import { createPublicClient, http, parseAbi, type AbiEvent, type PublicClient } from "viem";

// Complete registry ABI for the indexer. This is a SUPERSET of cli/src/lib/chain.ts:
// it adds SkillDeactivated + ProtocolFeeUpdated, which the indexer must observe but
// the CLI never reads. Keep event signatures byte-identical to AtriumRegistry.sol.
export const REGISTRY_ABI = parseAbi([
  // Events
  "event SkillRegistered(bytes32 indexed skillId, address indexed creator, bytes32 indexed didHash, string cid, uint256 pricePerCall, bytes32[] parentSkills, uint16[] parentBps)",
  "event SkillInvoked(bytes32 indexed skillId, address indexed caller, uint256 amount, uint128 invocationNumber)",
  "event RoyaltyPaid(bytes32 indexed parentSkillId, bytes32 indexed childSkillId, address indexed parentCreator, uint256 amount)",
  "event Withdraw(address indexed user, uint256 amount)",
  "event BenchmarkAttested(bytes32 indexed skillId, address indexed attester, bytes32 benchmarkHash, uint16 successRate, uint128 sampleCount)",
  "event SkillDeactivated(bytes32 indexed skillId)",
  "event ProtocolFeeUpdated(uint16 oldFee, uint16 newFee)",

  // Views (used for reconciliation + live reads the cache cannot answer)
  "function skills(bytes32) view returns (string cid, address creator, bytes32 didHash, uint256 pricePerCall, uint64 createdAt, uint64 lastInvoked, uint128 totalInvocations, uint128 totalEarned, bool active)",
  "function withdrawable(address) view returns (uint256)",
  "function protocolFeeBps() view returns (uint16)",
]);

// The subset of the ABI that getLogs subscribes to.
export const REGISTRY_EVENTS = REGISTRY_ABI.filter((item) => item.type === "event") as AbiEvent[];

export function makeClient(rpcUrl: string): PublicClient {
  // No `chain` needed: reads + getLogs only require a transport.
  return createPublicClient({ transport: http(rpcUrl) });
}
