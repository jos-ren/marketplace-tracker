"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import type { Listing, PriceObservation } from "@/lib/types";
import { isVehicle } from "@/lib/vehicle";
import { ListingCard } from "@/components/ListingCard";

type Tab = "new" | "seen" | "shortlist";

const TABS: { key: Tab; label: string }[] = [
  { key: "new", label: "New" },
  { key: "seen", label: "Seen" },
  { key: "shortlist", label: "Saved" },
];

type SortKey =
  | "added_desc"
  | "added_asc"
  | "posted_desc"
  | "posted_asc"
  | "price_asc"
  | "price_desc"
  | "mileage_asc"
  | "mileage_desc"
  | "views_desc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "added_desc", label: "Newest tracked" },
  { key: "added_asc", label: "Oldest tracked" },
  { key: "posted_desc", label: "Newest posted" },
  { key: "posted_asc", label: "Oldest posted" },
  { key: "price_asc", label: "Price: low → high" },
  { key: "price_desc", label: "Price: high → low" },
  { key: "mileage_asc", label: "Mileage: low → high" },
  { key: "mileage_desc", label: "Mileage: high → low" },
  { key: "views_desc", label: "Most viewed" },
];

const EMPTY_STATE: Record<Tab, string> = {
  new: "You're all caught up — nothing new or updated 🎉",
  seen: "Nothing seen yet — triage the New tab and they'll land here.",
  shortlist: "Nothing saved yet. Tap the star on a listing to save it.",
};

export default function Page() {
  const supabase = useMemo(() => getSupabase(), []);

  const [listings, setListings] = useState<Listing[]>([]);
  const [histories, setHistories] = useState<Record<string, PriceObservation[]>>({});
  const [tab, setTab] = useState<Tab>("new");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxMileage, setMaxMileage] = useState("");
  const [search, setSearch] = useState("");
  const [showNonVehicles, setShowNonVehicles] = useState(false);
  const [showNoPrice, setShowNoPrice] = useState(false);
  const [sort, setSort] = useState<SortKey>("added_desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close a popover on outside click. Opening one closes the other (handled at
  // the toggle sites), so at most one of these is ever open.
  useEffect(() => {
    if (!filtersOpen && !sortOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (filtersOpen && filtersRef.current && !filtersRef.current.contains(t)) {
        setFiltersOpen(false);
      }
      if (sortOpen && sortRef.current && !sortRef.current.contains(t)) {
        setSortOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filtersOpen, sortOpen]);

  const activeFilterCount =
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (maxMileage ? 1 : 0) +
    (showNonVehicles ? 1 : 0) +
    (showNoPrice ? 1 : 0);

  function clearFilters() {
    setMinPrice("");
    setMaxPrice("");
    setMaxMileage("");
    setShowNonVehicles(false);
    setShowNoPrice(false);
  }

  useEffect(() => {
    if (!supabase) {
      setError(
        "Missing Supabase config. Copy .env.local.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server."
      );
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // 1. Listings.
        const { data: rows, error: lErr } = await supabase
          .from("listings")
          .select("*")
          .order("last_seen", { ascending: false })
          .limit(2000);
        if (lErr) throw lErr;

        // 2. Full price history per listing (ascending by observed_at). The
        //    card derives the previous price and renders the history tooltip.
        const { data: ph } = await supabase
          .from("price_history")
          .select("listing_id, price, observed_at")
          .order("observed_at", { ascending: true });
        const hist: Record<string, PriceObservation[]> = {};
        (ph ?? []).forEach((r) => {
          (hist[r.listing_id] ??= []).push({
            price: r.price as number,
            observed_at: r.observed_at as string,
          });
        });

        if (cancelled) return;
        setListings((rows ?? []) as Listing[]);
        setHistories(hist);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  function toggleSaved(id: string, saved: boolean) {
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, saved } : l))
    ); // optimistic
    supabase
      ?.from("listings")
      .update({ saved })
      .eq("id", id)
      .then(({ error: uErr }) => {
        if (uErr) console.error("saved update failed", uErr);
      });
  }

  // Clear the New tab: every new/updated listing becomes "seen".
  function markAllSeen() {
    setListings((prev) =>
      prev.map((l) =>
        l.status === "new" || l.status === "updated"
          ? { ...l, status: "seen" }
          : l
      )
    ); // optimistic
    supabase
      ?.from("listings")
      .update({ status: "seen" })
      .in("status", ["new", "updated"])
      .then(({ error: uErr }) => {
        if (uErr) console.error("mark all seen failed", uErr);
      });
  }

  function recordView(id: string) {
    // Optimistic: bump the count + stamp viewed time. Status is left untouched —
    // view tracking is separate from the new/viewed/shortlisted/hidden workflow.
    setListings((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              view_count: l.view_count + 1,
              last_viewed_at: new Date().toISOString(),
            }
          : l
      )
    );
    supabase?.rpc("record_view", { p_id: id }).then(({ error: vErr }) => {
      if (vErr) console.error("record_view failed", vErr);
    });
  }

  // Hide non-vehicles (parts/accessories) and no-price listings unless opted in.
  const base = useMemo(() => {
    let rows = showNonVehicles ? listings : listings.filter(isVehicle);
    if (!showNoPrice) rows = rows.filter((l) => l.price != null);
    return rows;
  }, [listings, showNonVehicles, showNoPrice]);
  const hiddenNonVehicleCount = listings.length - listings.filter(isVehicle).length;
  const hiddenNoPriceCount = (
    showNonVehicles ? listings : listings.filter(isVehicle)
  ).filter((l) => l.price == null).length;

  const counts = useMemo(() => {
    const isNew = (l: Listing) => l.status === "new" || l.status === "updated";
    return {
      new: base.filter(isNew).length,
      seen: base.filter((l) => l.status === "seen").length,
      shortlist: base.filter((l) => l.saved).length,
    } as Record<Tab, number>;
  }, [base]);

  const visible = useMemo(() => {
    const mnp = minPrice ? parseInt(minPrice, 10) : null;
    const mp = maxPrice ? parseInt(maxPrice, 10) : null;
    const mm = maxMileage ? parseInt(maxMileage, 10) : null;
    const q = search.trim().toLowerCase();

    let rows = base.filter((l) => {
      if (mnp != null && l.price != null && l.price < mnp) return false;
      if (mp != null && l.price != null && l.price > mp) return false;
      if (mm != null && l.mileage != null && l.mileage > mm) return false;
      if (
        q &&
        !(l.title ?? "").toLowerCase().includes(q) &&
        !(l.make_model ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });

    // tab filter
    if (tab === "new") {
      rows = rows.filter((l) => l.status === "new" || l.status === "updated");
    } else if (tab === "seen") {
      rows = rows.filter((l) => l.status === "seen");
    } else {
      rows = rows.filter((l) => l.saved);
    }

    // sort — nulls always sort to the end regardless of direction
    const t = (s: string) => new Date(s).getTime();
    const cmp = (a: number | null, b: number | null, dir: 1 | -1) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return (a - b) * dir;
    };
    const postedTime = (l: Listing) => (l.posted_date ? t(l.posted_date) : null);

    const sorted = [...rows];
    switch (sort) {
      case "added_desc":
        sorted.sort((a, b) => t(b.first_seen) - t(a.first_seen));
        break;
      case "added_asc":
        sorted.sort((a, b) => t(a.first_seen) - t(b.first_seen));
        break;
      case "posted_desc":
        sorted.sort((a, b) => cmp(postedTime(a), postedTime(b), -1));
        break;
      case "posted_asc":
        sorted.sort((a, b) => cmp(postedTime(a), postedTime(b), 1));
        break;
      case "price_asc":
        sorted.sort((a, b) => cmp(a.price, b.price, 1));
        break;
      case "price_desc":
        sorted.sort((a, b) => cmp(a.price, b.price, -1));
        break;
      case "mileage_asc":
        sorted.sort((a, b) => cmp(a.mileage, b.mileage, 1));
        break;
      case "mileage_desc":
        sorted.sort((a, b) => cmp(a.mileage, b.mileage, -1));
        break;
      case "views_desc":
        sorted.sort((a, b) => b.view_count - a.view_count);
        break;
      default:
        sorted.sort((a, b) => t(b.first_seen) - t(a.first_seen));
    }
    return sorted;
  }, [base, tab, minPrice, maxPrice, maxMileage, search, sort]);

  // Combine the same vehicle across sites into one card. Match on
  // price + mileage + year (only when price & mileage are present); everything
  // else stays solo. Iteration order is preserved, so groups keep the sort.
  const groups = useMemo(() => {
    const map = new Map<string, Listing[]>();
    for (const l of visible) {
      const key =
        l.price != null && l.mileage != null
          ? `dup:${l.price}|${l.mileage}|${l.year ?? ""}`
          : `solo:${l.id}`;
      const arr = map.get(key);
      if (arr) arr.push(l);
      else map.set(key, [l]);
    }
    return Array.from(map.values());
  }, [visible]);

  const sourceCount = new Set(listings.map((l) => l.source)).size;
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "Newest tracked";

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 pb-20">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-border pt-10 pb-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-medium tracking-[-0.01em] text-foreground">
              Vehicle Tracker
            </h1>
            <p className="tabular mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {loading
                ? "Loading…"
                : `${listings.length} listings · ${sourceCount} source${
                    sourceCount === 1 ? "" : "s"
                  }`}
            </p>
          </div>
        </div>

        {/* Tabs + Mark all seen */}
        <div className="mt-8 flex items-center justify-between">
          <div className="flex gap-1">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex items-center gap-2 px-3 py-3 text-[13px] font-medium transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                <span
                  className={`tabular rounded px-1.5 py-0.5 text-[10px] ${
                    active
                      ? "bg-primary/20 text-primary"
                      : "bg-surface-2 text-muted-foreground"
                  }`}
                >
                  {counts[t.key]}
                </span>
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-px bg-foreground" />
                )}
              </button>
            );
          })}
          </div>

          {tab === "new" && counts.new > 0 && (
            <button
              type="button"
              onClick={markAllSeen}
              className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-foreground transition-colors hover:border-border-strong"
              title="Mark every new and updated listing as seen"
            >
              <CheckCheck size={16} className="text-muted-foreground" />
              Mark all seen
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Controls ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 py-5 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search make, model, or year…"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div className="flex gap-2">
          {/* Sort dropdown */}
          <div className="relative" ref={sortRef}>
            <button
              type="button"
              onClick={() => {
                setSortOpen((o) => !o);
                setFiltersOpen(false);
              }}
              className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-foreground transition-colors hover:border-border-strong"
            >
              <span className="text-muted-foreground">Sort:</span>
              <span>{sortLabel}</span>
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>

            {sortOpen && (
              <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-2xl ring-1 ring-border">
                {SORTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setSort(s.key);
                      setSortOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-surface-2 ${
                      sort === s.key ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filters dropdown */}
          <div className="relative" ref={filtersRef}>
            <button
              type="button"
              onClick={() => {
                setFiltersOpen((o) => !o);
                setSortOpen(false);
              }}
              className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-foreground transition-colors hover:border-border-strong"
            >
              <SlidersHorizontal size={14} className="text-muted-foreground" />
              Filters
              {activeFilterCount > 0 && (
                <span className="tabular flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filtersOpen && (
              <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-border bg-surface p-4 shadow-2xl ring-1 ring-border">
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                      Price (CAD)
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        placeholder="Min"
                        className="tabular w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                      />
                      <span className="text-border-strong">–</span>
                      <input
                        type="number"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        placeholder="Max"
                        className="tabular w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                      Max mileage (km)
                    </span>
                    <input
                      type="number"
                      value={maxMileage}
                      onChange={(e) => setMaxMileage(e.target.value)}
                      placeholder="Max km"
                      className="tabular w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={showNonVehicles}
                      onChange={(e) => setShowNonVehicles(e.target.checked)}
                      className="accent-[var(--primary)]"
                    />
                    Show parts/non-vehicles
                    {hiddenNonVehicleCount > 0 && !showNonVehicles && (
                      <span className="tabular text-muted-foreground">
                        ({hiddenNonVehicleCount})
                      </span>
                    )}
                  </label>

                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={showNoPrice}
                      onChange={(e) => setShowNoPrice(e.target.checked)}
                      className="accent-[var(--primary)]"
                    />
                    Show no-price listings
                    {hiddenNoPriceCount > 0 && !showNoPrice && (
                      <span className="tabular text-muted-foreground">
                        ({hiddenNoPriceCount})
                      </span>
                    )}
                  </label>

                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="self-start text-xs text-primary hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────────── */}
      {!loading && visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {EMPTY_STATE[tab]}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <ListingCard
              key={g[0].id}
              group={g}
              history={histories[g[0].id] ?? []}
              onSave={toggleSaved}
              onView={recordView}
            />
          ))}
        </div>
      )}
    </main>
  );
}
