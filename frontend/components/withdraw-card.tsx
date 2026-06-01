"use client";

import { useState } from "react";
import { useAccount, useConfig, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { Loader2, Banknote } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FaucetButton } from "@/components/faucet-button";
import { REGISTRY_ABI, REGISTRY_ADDRESS, USDC_ABI, USDC_ADDRESS } from "@/lib/contract";
import { formatUsdc } from "@/lib/format";

export function WithdrawCard({ address }: { address: `0x${string}` }) {
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balance = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address],
  });
  const withdrawable = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "withdrawable",
    args: [address],
  });

  const owed = (withdrawable.data as bigint | undefined) ?? 0n;

  async function onWithdraw() {
    setError(null);
    setBusy(true);
    try {
      const hash = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "withdraw",
      });
      await waitForTransactionReceipt(config, { hash });
      await Promise.all([withdrawable.refetch(), balance.refetch()]);
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 120) : "Withdraw failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="eyebrow text-muted-foreground">Wallet balance</div>
            <div className="mt-1 font-mono text-xl">
              {balance.data !== undefined ? formatUsdc(balance.data as bigint) : "—"} USDC
            </div>
          </div>
          <div>
            <div className="eyebrow text-muted-foreground">Withdrawable</div>
            <div className="mt-1 font-mono text-xl text-accent">{formatUsdc(owed)} USDC</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="w-full" disabled={busy || owed === 0n} onClick={onWithdraw}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
            {owed === 0n ? "Nothing to withdraw" : `Withdraw ${formatUsdc(owed)}`}
          </Button>
          <FaucetButton variant="primary" onClaimed={() => balance.refetch()} />
        </div>
        <p className="text-xs text-muted-foreground">Test USDC faucet — mints 1,000 mUSDC to your wallet on Base Sepolia.</p>
        {error && <p className="text-xs text-danger">{error}</p>}
      </CardBody>
    </Card>
  );
}
