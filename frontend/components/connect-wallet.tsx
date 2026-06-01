"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

/** RainbowKit connect, restyled to the Atrium olive pill. */
export function ConnectWallet() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!ready) {
          return <div className="h-9 w-24" aria-hidden />;
        }
        if (!connected) {
          return (
            <Button variant="primary" size="sm" onClick={openConnectModal}>
              <Wallet className="h-3.5 w-3.5" />
              Connect
            </Button>
          );
        }
        if (chain.unsupported) {
          return (
            <Button variant="secondary" size="sm" onClick={openChainModal}>
              Wrong network
            </Button>
          );
        }
        return (
          <Button variant="secondary" size="sm" onClick={openAccountModal}>
            <span className="h-2 w-2 rounded-full bg-accent" />
            {account.displayName}
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
}
