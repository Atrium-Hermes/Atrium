import { readFileSync } from "node:fs";
import { join } from "node:path";

const PINATA_GATEWAY = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs";
const PINATA_API = "https://api.pinata.cloud";

export class IpfsClient {
  constructor(private jwt: string) {
    if (!jwt) throw new Error("PINATA_JWT env required for IPFS operations");
  }

  /**
   * Pin a directory of files (skill bundle).
   * @returns CID of the directory
   */
  async pinDirectory(files: Array<{ path: string; content: Buffer | string }>): Promise<string> {
    const form = new FormData();
    // Pinata directory upload: every file is given a common root-folder prefix so
    // the pin is a single directory. The returned CID is that root folder, so each
    // file resolves at `<cid>/<path>` (e.g. `<cid>/skill.md` — what consumers fetch).
    // (Do NOT use wrapWithDirectory here: it only wraps a single file and rejects
    // multi-file uploads with "More than one file or directory was provided".)
    const root = "skill";
    for (const f of files) {
      const blob = new Blob([f.content], { type: "application/octet-stream" });
      form.append("file", blob, `${root}/${f.path}`);
    }
    form.append(
      "pinataMetadata",
      JSON.stringify({ name: `atrium-skill-${Date.now()}` })
    );
    form.append("pinataOptions", JSON.stringify({ wrapWithDirectory: false }));

    const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.jwt}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Pinata upload failed: ${res.status} ${body}`);
    }

    const data = (await res.json()) as { IpfsHash: string };
    return data.IpfsHash;
  }

  /**
   * Pin a single JSON object (skill manifest).
   */
  async pinJson(obj: unknown): Promise<string> {
    const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pinataContent: obj }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Pinata JSON pin failed: ${res.status} ${body}`);
    }

    const data = (await res.json()) as { IpfsHash: string };
    return data.IpfsHash;
  }

  /**
   * Fetch a file from IPFS via gateway.
   */
  async fetch(cid: string, path?: string): Promise<string> {
    const url = path ? `${PINATA_GATEWAY}/${cid}/${path}` : `${PINATA_GATEWAY}/${cid}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status} ${url}`);
    return res.text();
  }
}

export function getIpfsClient(): IpfsClient {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error(
      "PINATA_JWT not set. Get a free JWT at https://pinata.cloud and add to ~/.atrium/.env"
    );
  }
  return new IpfsClient(jwt);
}
