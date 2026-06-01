"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Lock, Loader2, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillBodyViewer } from "@/components/skill-body-viewer";
import { isEncrypted, extractEnvelope, decryptBody } from "@/lib/crypto";

/**
 * Renders a skill body. If the body is encrypted, shows a locked state with an
 * "Unlock" action that (1) signs a grant challenge with the wallet, (2) asks the
 * key-service for the content key — which it only releases if this wallet has an
 * on-chain invocation — and (3) decrypts client-side with WebCrypto.
 */
export function EncryptedBody({ skillId, body }: { skillId: string; body: string }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { openConnectModal } = useConnectModal();
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "unlocking" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!isEncrypted(body)) return <SkillBodyViewer body={body} />;
  if (plaintext !== null) return <SkillBodyViewer body={plaintext} />;

  async function onUnlock() {
    if (!isConnected || !address) return openConnectModal?.();
    setError(null);
    setStatus("unlocking");
    try {
      const env = extractEnvelope(body);
      if (!env) throw new Error("Encrypted body is malformed.");
      const addr = address.toLowerCase();
      const signature = await signMessageAsync({ message: `atrium-grant:${skillId}:${addr}` });
      const res = await fetch(`/api/keygrant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId, address, signature }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(res.status === 402 ? "Invoke (pay for) this skill first to unlock it." : j.error || `Key service error ${res.status}`);
      }
      const { keyHex } = (await res.json()) as { keyHex: string };
      setPlaintext(await decryptBody(env, keyHex));
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decryption failed");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-card-elevated p-8 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent">
        <Lock className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-medium">Encrypted skill body</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
        Only ciphertext is stored on IPFS. Invoke (pay for) the skill, then unlock to decrypt the
        body in your browser — the key is released only to wallets that have paid.
      </p>
      <div className="mt-5 flex justify-center">
        <Button onClick={onUnlock} disabled={status === "unlocking"}>
          {status === "unlocking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
          {status === "unlocking" ? "Unlocking…" : "Unlock (decrypt)"}
        </Button>
      </div>
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
    </div>
  );
}
