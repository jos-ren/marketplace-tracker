"use client";

import { Eye, ImageOff, Star } from "lucide-react";
import type { Listing, PriceObservation } from "@/lib/types";
import {
  daysSince,
  formatMileage,
  formatPrice,
  formatPriceDelta,
  postedShort,
  relativeTimeShort,
  trackedLabel,
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
  history,
  onSave,
  onView,
}: {
  group: Listing[];
  history: PriceObservation[];
  onSave: (id: string, saved: boolean) => void;
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

  // Price history is keyed on the representative listing (history[] is ascending
  // by observed_at; its last entry is the current price). The previous price is
  // the second-most-recent observation; only show a change badge when it differs
  // from the current price and we have ≥2 observations to compare/tooltip.
  const hasHistory = history.length >= 2;
  const previousPrice = hasHistory ? history[history.length - 2].price : null;
  const changed =
    previousPrice != null &&
    rep.price != null &&
    rep.price !== previousPrice;
  const dropped = changed && rep.price! < previousPrice!;
  const mileage = formatMileage(rep.mileage);

  const metaBits = [
    rep.year ? String(rep.year) : null,
    mileage,
    rep.location,
  ].filter(Boolean) as string[];

  const saved = rep.saved;
  const setSavedAll = (value: boolean) =>
    group.forEach((l) => onSave(l.id, value));

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-border-strong">
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

        {/* top-right save star — a ghost icon that fades in on hover; once
            saved it stays visible in warning-yellow. */}
        <button
          onClick={() => setSavedAll(!saved)}
          className={`absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-md bg-background/85 ring-1 ring-border-strong/50 backdrop-blur-md transition ${
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

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <a
            href={rep.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onView(rep.id)}
            title={rep.title ?? rep.make_model ?? "Untitled listing"}
            className="min-w-0 truncate text-[15px] font-medium leading-snug text-foreground transition-colors hover:text-primary"
          >
            {rep.title ?? rep.make_model ?? "Untitled listing"}
          </a>
          <div className="group/price relative flex shrink-0 flex-col items-end">
            <span
              className={`tabular text-base font-medium ${
                rep.price == null ? "text-muted-foreground" : "text-foreground"
              } ${
                hasHistory
                  ? "cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4"
                  : ""
              }`}
            >
              {formatPrice(rep.price)}
            </span>
            {changed && (
              <span
                className={`tabular text-[11px] font-medium ${
                  dropped ? "text-success" : "text-muted-foreground"
                }`}
              >
                {dropped ? "↓" : "↑"} {formatPriceDelta(rep.price! - previousPrice!)}
              </span>
            )}

            {/* Price-history tooltip — CSS hover, newest first. Only when we
                have ≥2 observations to show. */}
            {hasHistory && (
              <div className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-56 rounded-lg border border-border bg-surface p-2.5 opacity-0 shadow-2xl ring-1 ring-border transition-opacity duration-150 group-hover/price:opacity-100">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Price history
                </p>
                <ul className="flex flex-col gap-1">
                  {history
                    .map((obs, i) => ({ obs, i }))
                    .reverse()
                    .map(({ obs, i }) => {
                      const prev = i > 0 ? history[i - 1].price : null;
                      const step = prev != null ? obs.price - prev : 0;
                      return (
                        <li
                          key={obs.observed_at + i}
                          className="flex items-baseline justify-between gap-3"
                        >
                          <span className="tabular text-[13px] font-medium text-foreground">
                            {formatPrice(obs.price)}
                          </span>
                          <span className="flex items-baseline gap-1.5">
                            {step !== 0 && (
                              <span
                                className={`tabular text-[10px] font-medium ${
                                  step < 0
                                    ? "text-success"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {step < 0 ? "↓" : "↑"} {formatPriceDelta(step)}
                              </span>
                            )}
                            <span className="tabular text-[10px] text-muted-foreground">
                              {prev == null
                                ? "first seen"
                                : relativeTimeShort(obs.observed_at)}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
          </div>
        </div>

        {metaBits.length > 0 && (
          <p className="tabular text-xs text-muted-foreground">
            {metaBits.map((bit, i) => (
              <span key={i}>
                {i > 0 && <span className="text-muted-foreground/40"> • </span>}
                {bit}
              </span>
            ))}
          </p>
        )}

        {/* footer */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-muted-foreground/30 pt-3">
          <div className="tabular flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {(rep.status === "new" || rep.status === "updated") && (
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.1em] ${
                  rep.status === "new"
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/20 text-primary"
                }`}
              >
                {rep.status}
              </span>
            )}
            {stale && (
              <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-warning">
                Possibly sold
              </span>
            )}
            <span>{trackedLabel(firstSeen)}</span>
            {postedDate && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span title={`Listed ${postedDate}`}>
                  {postedShort(postedDate)}
                </span>
              </>
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
