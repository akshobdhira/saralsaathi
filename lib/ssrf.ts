import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class SsrfError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
}

const V4_BLOCKED: [string, number][] = [
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
];

function v4Private(ip: string): boolean {
  const n = v4ToInt(ip);
  return V4_BLOCKED.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === ((v4ToInt(base) & mask) >>> 0);
  });
}

/** Expand an IPv6 string into 8 16-bit groups (handles :: and embedded IPv4). */
function v6Groups(ip: string): number[] {
  let s = ip.toLowerCase().split("%")[0];
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = v4ToInt(v4[1]);
    s = s.slice(0, -v4[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = s.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  const fill = tail !== undefined ? Array(8 - h.length - t.length).fill("0") : [];
  return [...h, ...fill, ...t].map((g) => parseInt(g, 16) || 0);
}

export function isPrivateIp(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) return v4Private(ip);
  if (fam !== 6) return true; // not an IP: refuse
  const g = v6Groups(ip);
  // IPv4-mapped ::ffff:a.b.c.d and IPv4-compatible ::a.b.c.d
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
    if (g[5] === 0 && g[6] === 0 && g[7] <= 1) return true; // :: and ::1
    return v4Private(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  if (g[0] === 0x0064 && g[1] === 0xff9b) return true; // NAT64 could reach v4 internals
  if (g[0] === 0x2002) return true; // 6to4
  return false;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SsrfError("BAD_URL", "This link does not look right. Please check it and try again.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new SsrfError("BAD_URL", "Only web links starting with http:// or https:// can be opened.");
  if (u.port && u.port !== "80" && u.port !== "443")
    throw new SsrfError("BLOCKED_URL", "This link uses an unusual port and cannot be opened.");
  if (u.username || u.password)
    throw new SsrfError("BLOCKED_URL", "Links with a username or password cannot be opened.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  let addrs: { address: string }[];
  try {
    addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new SsrfError("DNS_FAILED", "We could not find this website. Please check the link.");
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address)))
    throw new SsrfError("BLOCKED_URL", "This link points to a private address and cannot be opened.");
  return u;
}

/**
 * Fetch a user-supplied URL safely: public IPs only, ports 80/443, max 3 redirects (each re-checked).
 * ponytail: DNS is checked then fetch resolves again (rebinding TOCTOU window); pin the IP via a custom
 * undici dispatcher if this ever fronts sensitive internal networks.
 */
export async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= 3; hop++) {
    const u = await assertPublicUrl(current);
    const res = await fetch(u, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, u).toString();
      await res.body?.cancel();
      continue;
    }
    return res;
  }
  throw new SsrfError("TOO_MANY_REDIRECTS", "This link redirects too many times and cannot be opened.");
}
