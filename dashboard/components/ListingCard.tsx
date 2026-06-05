"use client";

import type { Listing, ListingStatus } from "@/lib/types";
import {
  daysSince,
  firstSeenLabel,
  formatMileage,
  formatPrice,
  postedLabel,
  sourceLabel,
} from "@/lib/format";

// A card represents a GROUP of 1+ listings that are the same vehicle across
// sites (matched on price + mileage + year). group[0] is the representative
// (highest-sorted member, chosen by the caller).
export function ListingCard({
  group,
  previousPrice,
  onStatus,
  onView,
}: {
  group: Listing[];
  previousPrice: number | null;
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

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
      <div className="relative aspect-[4/3] bg-neutral-100 dark:bg-neutral-800">
        {photoListing.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoListing.photo_url}
            alt={rep.title ?? "listing photo"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
            no photo
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

        {/* one source badge per site, each linking to its own listing */}
        <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1">
          {sources.map((l) => (
            <a
              key={l.source}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onView(l.id)}
              className="rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white hover:bg-black/85"
              title={`Open on ${sourceLabel(l.source)}`}
            >
              {sourceLabel(l.source)}
            </a>
          ))}
        </div>

        {rep.status !== "new" && (
          <span className="absolute right-2 top-2 z-10 rounded bg-neutral-900/70 px-1.5 py-0.5 text-xs capitalize text-white">
            {rep.status}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <a
          href={rep.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onView(rep.id)}
          className="line-clamp-2 text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-100"
        >
          {rep.title ?? rep.make_model ?? "Untitled listing"}
        </a>

        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {formatPrice(rep.price)}
          </span>
          {dropped && (
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
              ⬇ was {formatPrice(previousPrice)}
            </span>
          )}
        </div>

        {metaBits.length > 0 && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {metaBits.join(" · ")}
          </p>
        )}

        {sources.length > 1 && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            On {sources.map((l) => sourceLabel(l.source)).join(" + ")}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-neutral-400">
          <span>{firstSeenLabel(firstSeen)}</span>
          {postedDate && (
            <span title={`Listed ${postedDate}`}>· {postedLabel(postedDate)}</span>
          )}
          {totalViews > 0 && (
            <span
              className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              title={`Opened ${totalViews} time${totalViews === 1 ? "" : "s"}`}
            >
              {totalViews} view{totalViews === 1 ? "" : "s"}
            </span>
          )}
          {stale && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              possibly sold
            </span>
          )}
        </div>

        <div className="mt-1 grid grid-cols-3 gap-1">
          <button
            onClick={() => setStatusAll("viewed")}
            className="rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            title="Mark as viewed"
          >
            ✓ Viewed
          </button>
          <button
            onClick={() => setStatusAll("shortlisted")}
            className="rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            title="Add to shortlist"
          >
            ★ Shortlist
          </button>
          <button
            onClick={() => setStatusAll("hidden")}
            className="rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            title="Hide"
          >
            ✕ Hide
          </button>
        </div>
      </div>
    </div>
  );
}
