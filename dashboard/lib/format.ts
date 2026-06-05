export function formatPrice(n: number | null): string {
  return n == null ? "No price" : "$" + n.toLocaleString("en-CA");
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

// Footer "Scraped …" reflects first_seen — when our tracker first captured the
// listing (distinct from "Posted", which is when the seller listed it).
export function scrapedLabel(iso: string): string {
  return `Scraped ${agoShort(iso)}`;
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
