// Network helpers for the Worker entry point.

/** Rate-limit key: the full IPv4 address, or the /64 network for IPv6 (one home or phone). */
export function clientKey(ip) {
  const s = String(ip || "unknown").toLowerCase();
  if (!s.includes(":")) return s;
  const [head, tail = ""] = s.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return `${full.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, "") || "0").join(":")}::/64`;
}
