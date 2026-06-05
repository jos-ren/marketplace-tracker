"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Listing, ListingStatus } from "@/lib/types";
import { isVehicle } from "@/lib/vehicle";
import { ListingCard } from "@/components/ListingCard";

type Tab = "new" | "all" | "shortlist" | "hidden";

const TABS: { key: Tab; label: string }[] = [
  { key: "new", label: "New" },
  { key: "all", label: "All" },
  { key: "shortlist", label: "Shortlist" },
  { key: "hidden", label: "Hidden" },
];

type SortKey =
  | "default"
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
  { key: "default", label: "Sort: Default" },
  { key: "added_desc", label: "Newest added" },
  { key: "added_asc", label: "Oldest added" },
  { key: "posted_desc", label: "Newest posted" },
  { key: "posted_asc", label: "Oldest posted" },
  { key: "price_asc", label: "Price: low → high" },
  { key: "price_desc", label: "Price: high → low" },
  { key: "mileage_asc", label: "Mileage: low → high" },
  { key: "mileage_desc", label: "Mileage: high → low" },
  { key: "views_desc", label: "Most viewed" },
];

const EMPTY_STATE: Record<Tab, string> = {
  new: "Nothing new since your last visit 🎉",
  all: "No listings yet — browse a supported site with the extension on.",
  shortlist: "No shortlisted listings yet. Star a few from the other tabs.",
  hidden: "Nothing hidden.",
};

export default function Page() {
  const supabase = useMemo(() => getSupabase(), []);

  const [listings, setListings] = useState<Listing[]>([]);
  const [prevPrices, setPrevPrices] = useState<Record<string, number | null>>({});
  const [lastVisit, setLastVisit] = useState<string | null>(null);
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
  const [sort, setSort] = useState<SortKey>("default");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  // close the Filters dropdown on outside click
  useEffect(() => {
    if (!filtersOpen) return;
    function onDown(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filtersOpen]);

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
        // 1. Read last_dashboard_visit FIRST (the "New" tab is computed against it).
        const { data: stateRow } = await supabase
          .from("app_state")
          .select("value")
          .eq("key", "last_dashboard_visit")
          .maybeSingle();
        const visit = stateRow?.value ?? null;

        // 2. Listings.
        const { data: rows, error: lErr } = await supabase
          .from("listings")
          .select("*")
          .order("last_seen", { ascending: false })
          .limit(2000);
        if (lErr) throw lErr;

        // 3. Price history -> "previous price" per listing (second-most-recent).
        const { data: ph } = await supabase
          .from("price_history")
          .select("listing_id, price, observed_at")
          .order("observed_at", { ascending: true });
        const byListing: Record<string, number[]> = {};
        (ph ?? []).forEach((r) => {
          (byListing[r.listing_id] ??= []).push(r.price as number);
        });
        const prev: Record<string, number | null> = {};
        for (const [lid, prices] of Object.entries(byListing)) {
          prev[lid] = prices.length >= 2 ? prices[prices.length - 2] : null;
        }

        if (cancelled) return;
        setLastVisit(visit);
        setListings((rows ?? []) as Listing[]);
        setPrevPrices(prev);
        setLoading(false);

        // 4. Stamp now() AFTER reading — order matters.
        await supabase
          .from("app_state")
          .update({ value: new Date().toISOString() })
          .eq("key", "last_dashboard_visit");
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

  function updateStatus(id: string, status: ListingStatus) {
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l))); // optimistic
    supabase
      ?.from("listings")
      .update({ status })
      .eq("id", id)
      .then(({ error: uErr }) => {
        if (uErr) console.error("status update failed", uErr);
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
    const isNew = (l: Listing) =>
      l.status === "new" &&
      (!lastVisit || new Date(l.first_seen) > new Date(lastVisit));
    return {
      new: base.filter(isNew).length,
      all: base.filter((l) => l.status !== "hidden").length,
      shortlist: base.filter((l) => l.status === "shortlisted").length,
      hidden: base.filter((l) => l.status === "hidden").length,
    } as Record<Tab, number>;
  }, [base, lastVisit]);

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
      rows = rows.filter(
        (l) =>
          l.status === "new" &&
          (!lastVisit || new Date(l.first_seen) > new Date(lastVisit))
      );
    } else if (tab === "all") {
      rows = rows.filter((l) => l.status !== "hidden");
    } else if (tab === "shortlist") {
      rows = rows.filter((l) => l.status === "shortlisted");
    } else {
      rows = rows.filter((l) => l.status === "hidden");
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
        // Default: New tab by first_seen desc; other tabs by last_seen desc.
        sorted.sort((a, b) =>
          tab === "new"
            ? t(b.first_seen) - t(a.first_seen)
            : t(b.last_seen) - t(a.last_seen)
        );
    }
    return sorted;
  }, [base, tab, lastVisit, minPrice, maxPrice, maxMileage, search, sort]);

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

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Vehicle Listing Tracker
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {loading ? "Loading…" : `${listings.length} listings tracked`}
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {t.label}
            <span className="ml-1.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title…"
          className="min-w-[12rem] flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Filters dropdown */}
        <div className="relative" ref={filtersRef}>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-neutral-900 px-1.5 text-xs text-white dark:bg-neutral-100 dark:text-neutral-900">
                {activeFilterCount}
              </span>
            )}
            <span className="text-neutral-400">▾</span>
          </button>

          {filtersOpen && (
            <div className="absolute right-0 z-10 mt-1 w-72 rounded-md border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-col gap-3">
                <div>
                  <span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Price
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="Min"
                      className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                    />
                    <span className="text-neutral-400">–</span>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="Max"
                      className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                    />
                  </div>
                </div>

                <div>
                  <span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Max mileage (km)
                  </span>
                  <input
                    type="number"
                    value={maxMileage}
                    onChange={(e) => setMaxMileage(e.target.value)}
                    placeholder="Max km"
                    className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  />
                </div>

                <label className="flex items-center gap-1.5 text-sm text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={showNonVehicles}
                    onChange={(e) => setShowNonVehicles(e.target.checked)}
                  />
                  Show parts/non-vehicles
                  {hiddenNonVehicleCount > 0 && !showNonVehicles && (
                    <span className="text-neutral-400">({hiddenNonVehicleCount})</span>
                  )}
                </label>

                <label className="flex items-center gap-1.5 text-sm text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={showNoPrice}
                    onChange={(e) => setShowNoPrice(e.target.checked)}
                  />
                  Show no-price listings
                  {hiddenNoPriceCount > 0 && !showNoPrice && (
                    <span className="text-neutral-400">({hiddenNoPriceCount})</span>
                  )}
                </label>

                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="self-start text-xs text-neutral-500 hover:underline dark:text-neutral-400"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      {!loading && visible.length === 0 ? (
        <p className="py-16 text-center text-neutral-500 dark:text-neutral-400">
          {EMPTY_STATE[tab]}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <ListingCard
              key={g[0].id}
              group={g}
              previousPrice={prevPrices[g[0].id] ?? null}
              onStatus={updateStatus}
              onView={recordView}
            />
          ))}
        </div>
      )}
    </main>
  );
}
