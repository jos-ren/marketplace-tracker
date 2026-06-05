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
