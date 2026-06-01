"use client";

import { useState } from "react";
import { useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { Loader2 } from "lucide-react";
import type { Hex } from "viem";
import { REGISTRY_ABI, REGISTRY_ADDRESS } from "@/lib/contract";

export function DeactivateButton({ skillId, onDone }: { skillId: string; onDone?: () => void }) {
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm("Deactivate this skill? This is permanent — it cannot be reactivated.")) return;
    setBusy(true);
    try {
      const hash = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "deactivateSkill",
        args: [skillId as Hex],
      });
      await waitForTransactionReceipt(config, { hash });
      onDone?.();
    } catch {
      /* surfaced by wallet; no-op */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-danger disabled:opacity-50"
    >
      {busy && <Loader2 className="h-3 w-3 animate-spin" />}
      Deactivate
    </button>
  );
}
