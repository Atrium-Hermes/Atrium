"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Check } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectWallet } from "@/components/connect-wallet";
import { getPinataJwt, setPinataJwt } from "@/lib/pinata";

export default function SettingsPage() {
  const { address, isConnected } = useAccount();
  const [jwt, setJwt] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setJwt(getPinataJwt() ?? "");
  }, []);

  function save() {
    setPinataJwt(jwt);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-display text-3xl font-semibold">Settings</h1>

      <Card className="mt-8">
        <CardBody className="space-y-3">
          <div className="font-medium">Pinata JWT</div>
          <p className="text-sm text-muted">
            Required to publish skills from the web (pins skill.md to IPFS). Get a pinning-scoped JWT
            at pinata.cloud. Stored only in this browser&apos;s localStorage.
          </p>
          <p className="text-xs text-danger/90">
            ⚠ A JWT in the browser is exposed to any XSS. Use a minimally-scoped token.
          </p>
          <Input
            type="password"
            value={jwt}
            onChange={(e) => setJwt(e.target.value)}
            placeholder="eyJ…"
            className="font-mono"
          />
          <Button onClick={save} disabled={!jwt}>
            {saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "Saved" : "Save JWT"}
          </Button>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardBody className="space-y-3">
          <div className="font-medium">Wallet</div>
          {isConnected ? (
            <p className="font-mono text-sm text-muted">{address}</p>
          ) : (
            <ConnectWallet />
          )}
          <p className="text-xs text-muted-foreground">
            Your DID identity (did:key) is managed by the <code>atrium</code> CLI in
            <code> ~/.atrium/identity.json</code> and is separate from this browser wallet.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
