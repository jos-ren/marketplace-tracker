export function formatPrice(n: number | null): string {
  return n == null ? "No price" : "$" + n.toLocaleString("en-CA");
}

// Absolute dollar amount of a price change, e.g. 1000 -> "$1,000". Sign/arrow
// is decided by the caller; this is just the magnitude.
export function formatPriceDelta(delta: number): string {
  return "$" + Math.abs(delta).toLocaleString("en-CA");
}

// All our sources are Canadian, so mileage is stored in km.
export function formatMileage(n: number | null): string | null {
  return n == null ? null : n.toLocaleString("en-CA") + " km";
}

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function firstSeenLabel(iso: string): string {
  const d = daysSince(iso);
  if (d <= 0) return "first seen today";
  if (d === 1) return "first seen yesterday";
  return `first seen ${d} days ago`;
}

export function postedLabel(iso: string): string {
  const d = daysSince(iso);
  if (d <= 0) return "posted today";
  if (d === 1) return "posted yesterday";
  return `posted ${d} days ago`;
}

// Compact "Nd ago" form for the card footer (uppercasing is left to CSS).
function agoShort(iso: string): string {
  const d = daysSince(iso);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return `${d}d ago`;
}

// Compact relative time with sub-day granularity, for timestamps we capture
// live (first_seen, price observations). Steps: just now → Nm → Nh → Nd → Nw ago.
export function relativeTimeShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// Footer "Tracked …" reflects first_seen — when our tracker first captured the
// listing (distinct from "Posted", which is when the seller listed it).
export function trackedLabel(iso: string): string {
  return `Tracked ${relativeTimeShort(iso)}`;
}

// Footer "Posted …" reflects the listing's posted_date.
export function postedShort(iso: string): string {
  return `Posted ${agoShort(iso)}`;
}

const SOURCE_LABELS: Record<string, string> = {
  facebook: "Facebook",
  autotrader: "AutoTrader",
  cargurus: "CarGurus",
  craigslist: "Craigslist",
  kijiji: "Kijiji",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

const SOURCE_CODES: Record<string, string> = {
  facebook: "FB",
  kijiji: "KJ",
  autotrader: "AT",
  cargurus: "CG",
  craigslist: "CL",
};

// 2-letter code for the source chip on the card photo.
export function sourceCode(source: string): string {
  return SOURCE_CODES[source] ?? source.slice(0, 2).toUpperCase();
}
