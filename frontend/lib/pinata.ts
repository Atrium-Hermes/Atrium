// Client-side IPFS pinning via Pinata. The JWT is pasted by the user in Settings
// and stored in localStorage. NOTE (per MEMORY.md gotcha #7): a JWT in the browser
// is exposed to any XSS — scope it to pinning-only and prefer a server proxy in prod.

const JWT_KEY = "atrium_pinata_jwt";
const PINATA_API = "https://api.pinata.cloud";

export function getPinataJwt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(JWT_KEY);
}

export function setPinataJwt(jwt: string): void {
  window.localStorage.setItem(JWT_KEY, jwt.trim());
}

/**
 * Pin skill.md wrapped in a directory (matches the CLI's pinDirectory), so the
 * returned CID resolves `<cid>/skill.md` — the path the indexer fetches.
 */
export async function pinSkill(jwt: string, content: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([content], { type: "text/markdown" }), "skill.md");
  form.append("pinataMetadata", JSON.stringify({ name: "atrium-skill" }));
  form.append("pinataOptions", JSON.stringify({ wrapWithDirectory: true }));

  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Pinata upload failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { IpfsHash: string };
  return data.IpfsHash;
}
