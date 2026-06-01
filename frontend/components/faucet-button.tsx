"use client";

import { useState } from "react";
import { useAccount, useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Droplets, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { USDC_ABI, USDC_ADDRESS } from "@/lib/contract";

/**
 * Claims 1,000 test USDC from the MockUSDC faucet (Base Sepolia). `onClaimed`
 * lets a parent refresh balances after the mint confirms.
 */
export function FaucetButton({
  variant = "secondary",
  className,
  onClaimed,
}: {
  variant?: "primary" | "secondary";
  className?: string;
  onClaimed?: () => void;
}) {
  const { isConnected } = useAccount();
  const config = useConfig();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<"idle" | "claiming" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onClaim() {
    if (!isConnected) return openConnectModal?.();
    setError(null);
    setStatus("claiming");
    try {
      const hash = await writeContractAsync({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "faucet" });
      await waitForTransactionReceipt(config, { hash });
      setStatus("done");
      onClaimed?.();
      setTimeout(() => setStatus("idle"), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 120) : "Faucet claim failed");
      setStatus("error");
    }
  }

  return (
    <div className={className}>
      <Button variant={variant} size="sm" className="w-full" disabled={status === "claiming"} onClick={onClaim}>
        {status === "claiming" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : status === "done" ? (
          <Check className="h-4 w-4" />
        ) : (
          <Droplets className="h-4 w-4" />
        )}
        {status === "claiming" ? "Claiming…" : status === "done" ? "Claimed 1,000 USDC" : "Claim test USDC"}
      </Button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
