import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Hex,
  type Address,
  type Chain,
  type LocalAccount,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { NETWORKS, type NetworkName, USDC_DECIMALS } from "../../../shared/schema.js";

export const REGISTRY_ABI = parseAbi([
  // Errors
  "error LengthMismatch()",
  "error RoyaltyTooHigh()",
  "error ParentInactive()",
  "error SkillExists()",
  "error SkillInactive()",
  "error NotCreator()",
  "error TransferFailed()",
  "error NothingToWithdraw()",
  "error InvalidSuccessRate()",
  "error FeeTooHigh()",
  "error NotOwner()",
  "error ZeroPrice()",

  // Write
  "function registerSkill(string cid, bytes32 didHash, uint256 pricePerCall, bytes32[] parentSkills, uint16[] parentBps) returns (bytes32 skillId)",
  "function invokeSkill(bytes32 skillId)",
  "function withdraw()",
  "function attestBenchmark(bytes32 skillId, bytes32 benchmarkHash, uint16 successRate, uint128 sampleCount)",
  "function deactivateSkill(bytes32 skillId)",

  // Views
  "function skills(bytes32) view returns (string cid, address creator, bytes32 didHash, uint256 pricePerCall, uint64 createdAt, uint64 lastInvoked, uint128 totalInvocations, uint128 totalEarned, bool active)",
  "function attestations(bytes32) view returns (bytes32 benchmarkHash, uint16 successRate, uint64 attestedAt, address attester, uint128 sampleCount)",
  "function withdrawable(address) view returns (uint256)",
  "function totalSkillCount() view returns (uint256)",
  "function listSkills(uint256 offset, uint256 limit) view returns (bytes32[])",
  "function getSkillsByCreator(address) view returns (bytes32[])",
  "function computeSkillId(string cid, bytes32 didHash, address creator) pure returns (bytes32)",
  "function protocolFeeBps() view returns (uint16)",
  "function protocolTreasury() view returns (address)",

  // Events
  "event SkillRegistered(bytes32 indexed skillId, address indexed creator, bytes32 indexed didHash, string cid, uint256 pricePerCall, bytes32[] parentSkills, uint16[] parentBps)",
  "event SkillInvoked(bytes32 indexed skillId, address indexed caller, uint256 amount, uint128 invocationNumber)",
  "event RoyaltyPaid(bytes32 indexed parentSkillId, bytes32 indexed childSkillId, address indexed parentCreator, uint256 amount)",
  "event Withdraw(address indexed user, uint256 amount)",
  "event BenchmarkAttested(bytes32 indexed skillId, address indexed attester, bytes32 benchmarkHash, uint16 successRate, uint128 sampleCount)",
]);

export const USDC_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

export interface ChainContext {
  network: NetworkName;
  publicClient: PublicClient;
  walletClient?: WalletClient;
  account?: Address;          // address, for read calls
  walletAccount?: LocalAccount; // signing account (privateKeyToAccount); signMessage is required on LocalAccount
  registry: Address;
  usdc: Address;
}

export function getChainContext(network: NetworkName = "base-sepolia"): ChainContext {
  const cfg = NETWORKS[network];
  if (!cfg.registry) {
    throw new Error(
      `Registry not configured for ${network}. Set ATRIUM_REGISTRY_${network === "base-sepolia" ? "SEPOLIA" : "MAINNET"} env var.`
    );
  }

  // Widen to the base Chain type so the inferred client matches ChainContext's
  // PublicClient; the base|baseSepolia union otherwise drives a getBlock variance.
  const chain: Chain = network === "base" ? base : baseSepolia;
  const publicClient = createPublicClient({ chain, transport: http(cfg.rpc) });

  const ctx: ChainContext = {
    network,
    publicClient,
    registry: cfg.registry,
    usdc: cfg.usdc,
  };

  const privateKey = process.env.ATRIUM_PRIVATE_KEY;
  if (privateKey) {
    const account = privateKeyToAccount(privateKey as Hex);
    ctx.walletClient = createWalletClient({ account, chain, transport: http(cfg.rpc) });
    ctx.account = account.address;
    ctx.walletAccount = account;
  }

  return ctx;
}

export async function getUsdcBalance(ctx: ChainContext, addr: Address): Promise<bigint> {
  return ctx.publicClient.readContract({
    address: ctx.usdc,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [addr],
  }) as Promise<bigint>;
}

export async function ensureAllowance(
  ctx: ChainContext,
  required: bigint
): Promise<{ approved: boolean; txHash?: Hex }> {
  if (!ctx.walletClient || !ctx.account) {
    throw new Error("Wallet not configured (set ATRIUM_PRIVATE_KEY)");
  }

  const current = (await ctx.publicClient.readContract({
    address: ctx.usdc,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [ctx.account, ctx.registry],
  })) as bigint;

  if (current >= required) return { approved: true };

  const txHash = await ctx.walletClient.writeContract({
    address: ctx.usdc,
    abi: USDC_ABI,
    functionName: "approve",
    args: [ctx.registry, required * 2n],
    chain: ctx.publicClient.chain!,
    account: ctx.walletAccount!,
  });

  await ctx.publicClient.waitForTransactionReceipt({ hash: txHash });
  return { approved: true, txHash };
}
