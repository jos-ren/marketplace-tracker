"use client";

import { Eye, ImageOff, Star } from "lucide-react";
import type { Listing, ListingStatus } from "@/lib/types";
import {
  daysSince,
  formatMileage,
  formatPrice,
  postedShort,
  scrapedLabel,
  sourceCode,
  sourceLabel,
} from "@/lib/format";

// Static class lookup so Tailwind can see every brand-dot color literally.
const BRAND_DOT: Record<string, string> = {
  facebook: "bg-brand-facebook",
  kijiji: "bg-brand-kijiji",
  autotrader: "bg-brand-autotrader",
  cargurus: "bg-brand-cargurus",
  craigslist: "bg-brand-craigslist",
};
const brandDot = (source: string) => BRAND_DOT[source] ?? "bg-muted-foreground";

// A card represents a GROUP of 1+ listings that are the same vehicle across
// sites (matched on price + mileage + year). group[0] is the representative
// (highest-sorted member, chosen by the caller).
export function ListingCard({
  group,
  previousPrice,
  showNewBadge = false,
  onStatus,
  onView,
}: {
  group: Listing[];
  previousPrice: number | null;
  // The "NEW" badge only makes sense in the New tab — a listing keeps
  // status "new" until triaged, but elsewhere it shouldn't shout "new".
  showNewBadge?: boolean;
  onStatus: (id: string, status: ListingStatus) => void;
  onView: (id: string) => void;
}) {
  if (!group || group.length === 0) return null;
  const rep = group[0];

  // one entry per distinct source, each linking to its own listing
  const sources: Listing[] = [];
  const seen = new Set<string>();
  for (const l of group) {
    if (!seen.has(l.source)) {
      seen.add(l.source);
      sources.push(l);
    }
  }

  const photoListing = group.find((l) => l.photo_url) ?? rep;
  const firstSeen = group.reduce(
    (min, l) => (l.first_seen < min ? l.first_seen : min),
    rep.first_seen
  );
  const lastSeen = group.reduce(
    (max, l) => (l.last_seen > max ? l.last_seen : max),
    rep.last_seen
  );
  const postedDate = group.map((l) => l.posted_date).find(Boolean) ?? null;
  const totalViews = group.reduce((sum, l) => sum + l.view_count, 0);

  const stale = daysSince(lastSeen) > 14;
  const dropped =
    previousPrice != null && rep.price != null && rep.price < previousPrice;
  const mileage = formatMileage(rep.mileage);

  const metaBits = [
    rep.year ? String(rep.year) : null,
    mileage,
    rep.location,
  ].filter(Boolean) as string[];

  const setStatusAll = (status: ListingStatus) =>
    group.forEach((l) => onStatus(l.id, status));

  const saved = rep.status === "shortlisted";

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border bg-surface transition-colors ${
        saved
          ? "border-primary/30 ring-1 ring-primary/40"
          : "border-border hover:border-border-strong"
      }`}
    >
      {/* ── Photo zone ─────────────────────────────────────────── */}
      <div className="group/photo relative aspect-[4/3] overflow-hidden rounded-t-xl bg-surface-2">
        {photoListing.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoListing.photo_url}
            alt={rep.title ?? "listing photo"}
            className="h-full w-full object-cover transition-transform duration-500 group-hover/photo:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground/40">
            <ImageOff size={28} strokeWidth={1.25} />
            <span className="tabular text-[10px] uppercase tracking-[0.18em]">
              No photo
            </span>
          </div>
        )}

        {/* full-cover link to the representative listing (sits under the badges) */}
        <a
          href={rep.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onView(rep.id)}
          aria-label="Open listing"
          className="absolute inset-0"
        />

        {/* one source chip per site, each linking to its own listing */}
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
          {sources.map((l) => (
            <a
              key={l.source}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onView(l.id)}
              className="flex items-center gap-1.5 rounded-md bg-background/85 px-2 py-1 ring-1 ring-border-strong/50 backdrop-blur-md transition-colors hover:bg-background"
              title={`Open on ${sourceLabel(l.source)}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${brandDot(l.source)}`}
              />
              <span className="tabular text-[10px] font-medium tracking-[0.08em] text-foreground">
                {sourceCode(l.source)}
              </span>
            </a>
          ))}
        </div>

        {/* top-right: NEW badge (New tab only) + save star.
            Star is a ghost icon that fades in on hover; once saved it stays
            visible in warning-yellow. */}
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
          {rep.status === "new" && showNewBadge && (
            <span className="flex items-center gap-1.5 rounded-md bg-primary/95 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-primary-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
              New
            </span>
          )}
          <button
            onClick={() => setStatusAll(saved ? "new" : "shortlisted")}
            className={`flex h-8 w-8 items-center justify-center rounded-md bg-background/85 ring-1 ring-border-strong/50 backdrop-blur-md transition ${
              saved
                ? "pointer-events-auto text-warning opacity-100"
                : "pointer-events-none text-foreground opacity-0 hover:text-warning group-hover/photo:pointer-events-auto group-hover/photo:opacity-100"
            }`}
            title={saved ? "Saved — click to remove" : "Save"}
            aria-label={saved ? "Remove from saved" : "Save"}
          >
            <Star size={16} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>

        {/* stale tag bottom-left */}
        {stale && (
          <span className="absolute bottom-3 left-3 z-10 rounded-md bg-warning/15 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-warning ring-1 ring-warning/25">
            Possibly sold
          </span>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <a
            href={rep.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onView(rep.id)}
            className="line-clamp-2 text-[15px] font-medium leading-snug text-foreground transition-colors hover:text-primary"
          >
            {rep.title ?? rep.make_model ?? "Untitled listing"}
          </a>
          <div className="flex shrink-0 flex-col items-end">
            <span
              className={`tabular text-base font-medium ${
                rep.price == null ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {formatPrice(rep.price)}
            </span>
            {dropped && (
              <span className="tabular text-[11px] font-medium text-success">
                ↓ was {formatPrice(previousPrice)}
              </span>
            )}
          </div>
        </div>

        {metaBits.length > 0 && (
          <p className="tabular text-xs text-muted-foreground">
            {metaBits.map((bit, i) => (
              <span key={i}>
                {i > 0 && <span className="text-border-strong"> · </span>}
                {bit}
              </span>
            ))}
          </p>
        )}

        {/* footer */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="tabular flex items-center gap-3 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            <span>{scrapedLabel(firstSeen)}</span>
            {postedDate && (
              <span title={`Listed ${postedDate}`}>{postedShort(postedDate)}</span>
            )}
          </div>
          {totalViews > 0 && (
            <span
              className="tabular flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              title={`Opened ${totalViews} time${totalViews === 1 ? "" : "s"}`}
            >
              <Eye size={12} />
              {totalViews}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
