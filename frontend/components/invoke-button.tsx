"use client";

import { useState } from "react";
import { useAccount, useConfig, useWriteContract } from "wagmi";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Zap, Check, Loader2 } from "lucide-react";
import type { Hex } from "viem";
import { Button } from "@/components/ui/button";
import { REGISTRY_ABI, REGISTRY_ADDRESS, USDC_ABI, USDC_ADDRESS } from "@/lib/contract";

type Status = "idle" | "checking" | "approving" | "invoking" | "done" | "error";

const LABELS: Record<Status, string> = {
  idle: "",
  checking: "Checking allowance…",
  approving: "Approve USDC in wallet…",
  invoking: "Confirm invocation…",
  done: "Invoked ✓",
  error: "",
};

export function InvokeButton({ skillId, priceRaw, price, active }: {
  skillId: string;
  priceRaw: string;
  price: string;
  active: boolean;
}) {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = status === "checking" || status === "approving" || status === "invoking";

  async function onInvoke() {
    if (!isConnected || !address) return openConnectModal?.();
    setError(null);
    try {
      const amount = BigInt(priceRaw);
      setStatus("checking");
      const allowance = (await readContract(config, {
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "allowance",
        args: [address, REGISTRY_ADDRESS],
      })) as bigint;

      // USDC approve only if current allowance is short (avoids a redundant tx).
      if (allowance < amount) {
        setStatus("approving");
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "approve",
          args: [REGISTRY_ADDRESS, amount],
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
      }

      setStatus("invoking");
      const invokeHash = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "invokeSkill",
        args: [skillId as Hex],
      });
      await waitForTransactionReceipt(config, { hash: invokeHash });
      setStatus("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <Button className="w-full" variant="secondary" disabled>
        <Check className="h-4 w-4 text-accent" /> Invoked — paid {price} USDC
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" disabled={!active || busy} onClick={onInvoke}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        {!active ? "Skill inactive" : busy ? LABELS[status] : `Invoke for ${price} USDC`}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
