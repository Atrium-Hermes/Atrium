import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia, base } from "wagmi/chains";
import { CHAIN_ID } from "./contract";

const chain = CHAIN_ID === base.id ? base : baseSepolia;

// projectId is required by getDefaultConfig; a placeholder still enables injected
// wallets (MetaMask etc.). Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID for the
// WalletConnect modal.
export const wagmiConfig = getDefaultConfig({
  appName: "Atrium",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "atrium_dev_placeholder",
  chains: [chain],
  ssr: true,
});
