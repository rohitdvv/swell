import "server-only";
import dns from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

// ============================================================
// SSRF-safe fetch for every URL a user can influence (their website, logo
// and hero-image URLs in a brand kit).
//
// The check happens at SOCKET CONNECT time, inside the DNS lookup the HTTP
// client actually uses. Checking DNS first and fetching second is bypassable
// by DNS rebinding; this is not. Because every connection — including each
// redirect hop — resolves through the same guarded lookup, a public URL that
// redirects to 169.254.169.254 is refused too.
// ============================================================

const blocked = new net.BlockList();
// IPv4: unspecified, private, CGNAT, loopback, link-local (cloud metadata),
// IETF protocol assignments, docs/test nets, benchmarking, multicast, reserved.
for (const [addr, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv4");
}
// IPv6: unspecified, loopback, NAT64, docs, unique-local, link-local, multicast.
for (const [addr, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv6");
}

/** True for any address a server-side fetch must never reach. */
export function isBlockedAddress(address: string): boolean {
  // IPv4-mapped IPv6 (::ffff:169.254.169.254) — judge the embedded IPv4.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return blocked.check(mapped[1], "ipv4");
  const family = net.isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family === 6) return blocked.check(address, "ipv6");
  return true; // not an IP at all — refuse
}

export class UnsafeUrlError extends Error {}

type LookupCb = (
  err: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family?: number
) => void;

/** The DNS lookup undici connects through — refuses private destinations. */
function guardedLookup(hostname: string, options: dns.LookupOptions, cb: LookupCb): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return cb(err, []);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => isBlockedAddress(a.address));
    if (bad || list.length === 0) {
      const e = new UnsafeUrlError(`Refusing to connect to a private address for ${hostname}`);
      return cb(e as NodeJS.ErrnoException, []);
    }
    if (options.all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
}

const agent = new Agent({
  connect: { lookup: guardedLookup as never },
  headersTimeout: 8_000,
  bodyTimeout: 8_000,
});

const MAX_REDIRECTS = 3;

/** Syntactic check before any network I/O: http(s) only, no credentials, no raw private IPs. */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http(s) URLs are allowed.");
  }
  if (url.username || url.password) throw new UnsafeUrlError("URLs with credentials are not allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isBlockedAddress(host)) {
    throw new UnsafeUrlError("That address is not reachable.");
  }
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) {
    throw new UnsafeUrlError("That address is not reachable.");
  }
  return url;
}

/**
 * Fetch a user-supplied URL safely. Returns the body as a Buffer, capped at
 * `maxBytes` (streamed — never buffers an oversized response in full).
 */
export async function safeFetch(
  raw: string,
  opts: { maxBytes?: number; timeoutMs?: number; accept?: string; userAgent?: string } = {}
): Promise<{ ok: boolean; status: number; body: Buffer; contentType: string; url: string }> {
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  let current = assertSafeUrl(raw);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await undiciFetch(current, {
      dispatcher: agent,
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8_000),
      headers: {
        accept: opts.accept ?? "*/*",
        ...(opts.userAgent ? { "user-agent": opts.userAgent } : {}),
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel();
      if (!loc) throw new UnsafeUrlError("Redirect without a location.");
      current = assertSafeUrl(new URL(loc, current).toString());
      continue;
    }

    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > maxBytes) {
      await res.body?.cancel();
      throw new UnsafeUrlError(`Response too large (${declared} bytes).`);
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    if (res.body) {
      for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
        total += chunk.byteLength;
        if (total > maxBytes) throw new UnsafeUrlError("Response too large.");
        chunks.push(chunk);
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      body: Buffer.concat(chunks),
      contentType: res.headers.get("content-type") || "",
      url: current.toString(),
    };
  }
  throw new UnsafeUrlError("Too many redirects.");
}
