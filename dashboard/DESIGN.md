# Vehicle Tracker — Design Specification

A complete handoff document for the Vehicle Listing Tracker dashboard.
Everything needed to rebuild the UI in another codebase, framework, or tool.

---

## 1. Design Principles

1. **Dark-first.** The app is used at night. Light mode is a polished mirror, not the default.
2. **Calm density.** Information-rich, but never noisy. Hairlines over shadows. Restrained color.
3. **One accent.** A single blue carries "new", "selected", "active". Status colors (amber, green, red) only appear when semantically meaningful.
4. **Numbers are typography.** Prices, mileage, dates, counts all render in a monospaced face so columns of data align visually even outside tables.
5. **The card is the product.** Everything orbits a single component — the listing card — and every state it can occupy is designed, not improvised.

---

## 2. Color System — "Pure Graphite"

All colors are defined as CSS custom properties in `oklch()` and exposed via Tailwind tokens.

### 2.1 Dark mode (default)

| Token | OKLCH | Hex equiv. | Purpose |
|---|---|---|---|
| `--background` | `oklch(0.145 0 0)` | `#0a0a0a` | App background |
| `--surface` | `oklch(0.196 0 0)` | `#171717` | Card, header, popover |
| `--surface-2` | `oklch(0.245 0 0)` | `#262626` | Inset (badge bg, empty photo, count chip) |
| `--foreground` | `oklch(0.985 0 0)` | `#fafafa` | Primary text |
| `--muted-foreground` | `oklch(0.62 0 0)` | `#9c9c9c` | Secondary text, meta |
| `--border` | `oklch(0.245 0 0 / 70%)` | `#26262633` | Default 1px borders |
| `--border-strong` | `oklch(0.35 0 0)` | `#525252` | Hover / focus borders, separators in dense type |
| `--primary` | `oklch(0.623 0.214 259.815)` | `#3b82f6` | Accent. "New" badge, active states, links |
| `--primary-foreground` | `oklch(0.985 0 0)` | `#fafafa` | Text on primary |
| `--success` | `oklch(0.72 0.17 152)` | `~#33c97a` | Price drops, "viewed" affordance hover |
| `--warning` | `oklch(0.78 0.15 75)` | `~#e4b03d` | Shortlisted, "possibly sold" |
| `--destructive` | `oklch(0.62 0.21 25)` | `~#e44b3b` | Hide hover, errors |
| `--ring` | `oklch(0.623 0.214 259.815 / 50%)` | `#3b82f680` | Focus ring |

### 2.2 Light mode (`.light` class on `<html>`)

| Token | OKLCH | Hex equiv. |
|---|---|---|
| `--background` | `oklch(0.99 0 0)` | `#fcfcfc` |
| `--surface` | `oklch(1 0 0)` | `#ffffff` |
| `--surface-2` | `oklch(0.965 0 0)` | `#f3f3f3` |
| `--foreground` | `oklch(0.18 0 0)` | `#1f1f1f` |
| `--muted-foreground` | `oklch(0.5 0 0)` | `#7a7a7a` |
| `--border` | `oklch(0.9 0 0)` | `#e3e3e3` |
| `--border-strong` | `oklch(0.82 0 0)` | `#c9c9c9` |
| `--primary` | `oklch(0.55 0.22 259.815)` | `#2563eb` |

Semantic colors (success/warning/destructive) carry over from dark mode — adjust lightness +0.05 if contrast feels off on white.

### 2.3 Marketplace brand dots

A tiny colored dot, never a fill, so the chip stays neutral.

| Source | Token | OKLCH | Hex equiv. |
|---|---|---|---|
| Facebook | `--brand-facebook` | `oklch(0.58 0.18 258)` | `~#3b6ed6` |
| Kijiji | `--brand-kijiji` | `oklch(0.72 0.14 50)` | `~#d8923c` |
| AutoTrader | `--brand-autotrader` | `oklch(0.62 0.22 25)` | `~#e44b3b` |
| CarGurus | `--brand-cargurus` | `oklch(0.68 0.18 145)` | `~#3fb16e` |
| Craigslist | `--brand-craigslist` | `oklch(0.55 0.19 295)` | `~#7d4fcb` |

---

## 3. Typography

Two families, three roles. No third font.

### 3.1 Families

- **Sans (UI):** `Rubik`, weights 400 / 500 / 600. Used for everything that reads as language: headlines, body, labels, buttons.
- **Mono (Data):** `Space Mono`, weights 400 / 700. Used for every number that benefits from tabular alignment — prices, mileage, view counts, "seen 2d ago" timestamps, filter unit labels.

Both loaded via `@fontsource/rubik` and `@fontsource/space-mono` (self-hosted, no CDN).

### 3.2 Type scale

| Role | Size | Line height | Weight | Tracking | Where |
|---|---|---|---|---|---|
| Page title (H1) | 24 px (1.5rem) | 1.2 | 500 | -0.01em | Header |
| Section / card title | 15 px | 1.4 (snug) | 500 | normal | Listing title |
| Body | 14 px (0.875rem) | 1.5 | 400 | normal | Default text |
| Meta | 12 px (0.75rem) | 1.4 | 400 | normal | Card meta (year · km · location) |
| Small label | 11 px (0.6875rem) | 1.4 | 400 | normal | Multi-source line |
| Eyebrow / uppercase label | 10–11 px | 1.4 | 500 | 0.15–0.18em | "Synced 2m ago", filter labels, action buttons |
| Tag / badge | 10 px | 1 | 500 | 0.12–0.18em | "New", "Shortlisted", "Possibly sold" |
| Price | 16 px | 1 | 500 (mono) | tight | Card price |
| Price-drop | 11 px | 1 | 500 (mono) | normal | Below price |
| Tabular meta | 10–12 px | 1.4 | 400 (mono) | normal | Mileage, dates, view counts |

### 3.3 Numeric pattern

Apply `.tabular` (or `font-mono` + `font-feature-settings: "tnum"`) to **every number the user reads as data**: price, "was $X", year, mileage, location strings, "Seen 2d ago", "Posted 3d ago", views, filter counts (`12`, `84`, `5`), filter inputs.

Tab labels themselves stay sans; their count chip is mono.

---

## 4. Spacing, Radius, Borders

### 4.1 Spacing

Tailwind default scale; the following values are the load-bearing ones:

- **2 / 3 (8–12px):** inside-card gap between rows
- **4 (16px):** card padding
- **5 (20px):** grid gutter
- **6 (24px):** page horizontal padding
- **10 / 12 (40–48px):** vertical rhythm between major sections (header → tabs → controls → grid)

### 4.2 Radius

`--radius: 0.625rem` (10px). Used directly on cards. Derived:

- `rounded-md` = 8 px → buttons, source badges, status badges, filter inputs
- `rounded-lg` = 10 px → search input, sort/filter buttons, popovers
- `rounded-xl` = 12 px → listing card
- Photo: `rounded-t-xl` (matches card top)
- Pills / count chips: `rounded` (4 px)
- Status dot, multi-source dots: `rounded-full`

### 4.3 Borders

- Default: `1px solid var(--border)` (low contrast)
- Hover / focus surface: `1px solid var(--border-strong)`
- Shortlisted card highlight: `1px solid color-mix(in oklab, var(--primary) 30%, transparent)` plus a `ring-1` in `--primary/40`
- Hairline divider inside cards (between body / footer / actions): `1px solid var(--border)`
- Empty state: dashed border in `--border`

**No drop shadows anywhere except the popover** (`shadow-2xl`), and a small inset `ring-1` to lift dropdowns from the surface.

---

## 5. Page Layout

### 5.1 Container

`max-w-7xl` (1280 px) centered, horizontal padding `px-6` (24 px). The grid never goes edge-to-edge — there's always a 24 px gutter on desktop.

### 5.2 Vertical structure

```
┌────────────────────────────────────────────────┐
│ HEADER (border-bottom)                         │
│   pt-10 pb-6                                   │
│   ┌ Title + meta            Synced 2m ago ──┐  │
│   │ Tabs (px-3 py-3, underline on active)  │  │
│   └─────────────────────────────────────────┘  │
├────────────────────────────────────────────────┤
│ CONTROLS  py-5                                  │
│   ┌ Search (flex-1) ┬ Sort ┬ Filters ┐         │
├────────────────────────────────────────────────┤
│ GRID  pb-20                                     │
│   gap-5, 1 / 2 / 3 columns                      │
└────────────────────────────────────────────────┘
```

### 5.3 Header anatomy

- Title row: `flex items-end justify-between`. Left: page title + monospaced meta (`{N} listings · 5 sources`). Right: small green dot + "Synced 2m ago".
- Tab row: `flex gap-1`. Each tab is `px-3 py-3`, text 13 px / 500. Active tab has full-opacity foreground + a 1 px underline drawn with an absolutely positioned `bottom-0 inset-x-0 h-px bg-foreground`. Count chip: `rounded px-1.5 py-0.5 text-[10px]` — primary tint on active, surface-2 on inactive.

### 5.4 Controls row

- Search: `h-10 flex-1`, leading search icon at `left-3`, `pl-9 pr-3`. Background `surface`, focus ring 2px in `ring/40`.
- Sort & Filters: `h-10` buttons, `border border-border bg-surface`. Hover border becomes `border-strong`. Both expose a chevron / icon at 14 px / muted color. Filters button shows a 20 px circular `bg-primary` badge with the active filter count when > 0.
- Both dropdowns: absolutely positioned, `mt-2`, `border border-border bg-popover shadow-2xl`, width 192 px (sort) / 320 px (filters). Open one closes the other.

---

## 6. The Listing Card

### 6.1 Geometry

- Width: spans the grid column (no fixed width).
- Photo: `aspect-[4/3]`, rounded top corners only.
- Body padding: `p-4`, internal `gap-3` between blocks (title row → meta → multi-source line → footer).
- Footer separator: `border-t border-border pt-3`.
- Actions row: 3 equal columns with vertical hairline dividers (`border-x` on middle button), `py-2.5`.

### 6.2 Photo zone (overlays)

```
┌────────────────────────────────────┐
│ [FB · KJ]              [NEW]      │ ← top-3 left/right
│                                    │
│            (4:3 image)             │
│                                    │
│ [Possibly sold]                    │ ← bottom-3 left (only when stale)
└────────────────────────────────────┘
```

- **Source chip:** `bg-background/85 backdrop-blur-md rounded-md px-2 py-1`, ring `border-strong/50`, text 10px / 500. Inside: a 6px brand-colored dot + 2-letter source code (`FB`, `KJ`, `AT`, `CG`, `CL`). Clickable — opens that source's listing in a new tab.
- **Status badge (top-right):**
  - `new` → solid `bg-primary/95` + pulsing white dot, `text-primary-foreground`, uppercase tracked.
  - `viewed` / `shortlisted` / `hidden` → translucent `bg-background/85` + tinted text (muted / warning / muted).
- **Stale tag (bottom-left, only when `staleDays > 14`):** `bg-warning/15 text-warning ring-1 ring-warning/25`, "Possibly sold".

### 6.3 No-photo fallback

Full-bleed `surface-2` rectangle, centered icon (`lucide ImageOff`, 28 px, weight 1.25, `text-muted-foreground/40`) above a mono 10 px / 0.18em "No photo" eyebrow. Same overlays still render on top.

### 6.4 Body

```
2019 Porsche 911 Carrera S        $134,900
                                  ↓ was $138,500
2019 · 42,000 km · Toronto, ON

● ● On Facebook + Kijiji          ← only when multi-source

──────────────────────────────────
SEEN 2D AGO   POSTED 3D AGO   👁 8
```

- **Title:** 15 px / 500, `line-clamp-2`, hovers to `primary`.
- **Price:** 16 px / 500 mono, right-aligned. Drop indicator below in `success`, 11 px mono.
- **No price** state: 14 px / 400 muted-foreground, reads "No price".
- **Meta line:** 12 px muted, separator `·` rendered in `border-strong` so it visually recedes.
- **Multi-source line:** appears only when `sources.length > 1`. Inline cluster of overlapping 8 px brand dots (`-space-x-1`, ringed in `surface` for separation) followed by "On Facebook + Kijiji" in 11 px muted.
- **Footer row:**
  - Left: mono 10 px / 0.1em uppercase, "Seen Nd ago" and "Posted Nd ago" separated by `gap-3`.
  - Right: view counter `bg-surface-2 px-1.5 py-0.5 rounded` with eye icon, only shown when `views > 0`.

### 6.5 Action bar

3 equal columns: **Viewed · Save · Hide**. Each cell:

- `py-2.5`, text 11 px / 500, uppercase, tracking `0.12em`.
- Default: `text-muted-foreground`.
- Hover: surface-2 background + color shift — green for Viewed, amber for Save, red for Hide.
- Selected state:
  - Viewed → `bg-surface-2 text-foreground` with a green check.
  - Saved → `bg-warning/15 text-warning`, star filled, label flips to "Saved".
  - Hide → no persistent on-state (clicking moves the card to Hidden tab).

### 6.6 Card-level state matrix

| State | Card chrome | Badge | Notes |
|---|---|---|---|
| `new` | Default | Solid primary "NEW" | Default highlight; lives in New tab |
| `viewed` | Default | Translucent "Viewed" (muted) | Viewed action highlighted |
| `shortlisted` | `border-primary/30 ring-1 ring-primary/40` | Translucent "Shortlisted" (warning) | Save action tinted warning |
| `hidden` | `opacity-60` | Translucent "Hidden" | Only visible in Hidden tab |
| Multi-source | + dot cluster + "On … + …" line | — | Source chip row shows N chips |
| Price drop | + `↓ was $X` line below price | — | Green success token |
| Stale (>14 days unseen) | — | + "Possibly sold" amber tag bottom-left | Implies "viewed" state for other UI |
| No photo | `surface-2` fallback w/ icon | — | All overlays still render |
| No price | Price renders as muted "No price" | — | Sort by price puts these last |

---

## 7. Tabs Behavior

Four tabs, fixed order, each backed by a derived count:

| Tab | Predicate | Empty message |
|---|---|---|
| New | `status === 'new'` | "Nothing new since your last visit." |
| All | `status !== 'hidden'` | "No listings match." |
| Shortlist | `status === 'shortlisted'` | "Your shortlist is empty." |
| Hidden | `status === 'hidden'` | "Nothing hidden." |

Counts always reflect the underlying dataset (not the post-filter set), so the user can see "12 new" even while searching.

---

## 8. Controls Behavior

### 8.1 Search

- Matches `title` (case-insensitive `includes`). Extend to `make/model` once normalized fields exist.
- Trim before comparing; empty string is a no-op.

### 8.2 Sort

Default order is whatever the dataset returns (typically newest-added). Options:

`Default · Newest added · Oldest added · Newest posted · Oldest posted · Price ↑ · Price ↓ · Mileage ↑ · Mileage ↓ · Most viewed`

Null prices sort last in price-asc, first-from-bottom in price-desc.

### 8.3 Filters

Popover panel, 320 px wide:

- **Price (CAD):** two number inputs (Min / Max) side-by-side.
- **Max mileage (km):** single number input.
- *(Future)* toggles for "Show parts/non-vehicles" and "Show no-price listings".
- **Clear filters** link in `primary` when ≥1 filter is active.

Active-filter count badge shows on the trigger button (`bg-primary` 20 px circle).

---

## 9. Responsive Breakpoints

Uses Tailwind defaults; the design only meaningfully responds at three points.

| Breakpoint | Width | Grid columns | Notable changes |
|---|---|---|---|
| Base (mobile) | < 768 px | 1 | Header title row stacks if needed; controls become a vertical column (search full-width, sort + filters side-by-side beneath). |
| `md` | ≥ 768 px | 2 | Controls become a single horizontal row. |
| `lg` | ≥ 1024 px | 3 | Final grid density. Max container caps at 1280 px (`max-w-7xl`). |

Card composition does not change across breakpoints — only the column count.

Touch targets: every action button and chip is ≥ 28 px tall; bottom action bar is 36 px (`py-2.5` + content) which clears Apple's 44 px guideline once you include the surrounding card padding.

---

## 10. Motion

Restrained. Every transition uses `transition-colors` unless otherwise noted.

- **Photo hover:** `scale-[1.02]` over 500 ms.
- **"New" dot:** Tailwind `animate-pulse` on the inner dot.
- **Cards:** border color transitions on hover (`hover:border-border-strong`).
- **Buttons:** color + background on hover only. No translate/scale.
- **Dropdowns:** open instantly (no enter animation) — the goal is power-user feel.

If you want richer motion later, the only places it earns its keep:
- Card move-out animation when triaged (slide + fade left/right depending on action).
- Sparkline drawing on price-history hover.

---

## 11. Iconography

Lucide icons only, stroke-width `1.5` default, `1.25` for the no-photo placeholder. Sizes used: 12, 14, 16, 20 px. Icons inherit `currentColor`.

| Symbol | Icon | Usage |
|---|---|---|
| Search | `Search` | Search input leading |
| Filters | `SlidersHorizontal` | Filters trigger |
| Chevron | `ChevronDown` | Sort trigger |
| Check | `Check` | Viewed action |
| Star | `Star` (filled when shortlisted) | Save action |
| Close | `X` | Hide action |
| Views | `Eye` | View-count chip |
| No image | `ImageOff` | Photo fallback |
| External | `ExternalLink` | Reserved for source-chip affordance |

---

## 12. Token / class quick reference

```css
/* Page background */
background: var(--background);          /* #0a0a0a */

/* Card */
background: var(--surface);              /* #171717 */
border: 1px solid var(--border);         /* #26262633 */
border-radius: 0.75rem;                  /* 12px */

/* Inset (badges, no-photo bg, view chip) */
background: var(--surface-2);            /* #262626 */

/* Primary action / new */
background: var(--primary);              /* #3b82f6 */
color: var(--primary-foreground);

/* Success (price drop) */
color: var(--success);

/* Warning (shortlist + stale) */
background: color-mix(in oklab, var(--warning) 15%, transparent);
color: var(--warning);

/* Destructive (hide hover) */
color: var(--destructive);
```

---

## 13. Implementation files in this repo

| File | What lives here |
|---|---|
| `src/styles.css` | All tokens, font imports, base layer |
| `src/routes/index.tsx` | Page layout, header, tabs, controls, grid, empty states |
| `src/components/listing-card.tsx` | The card itself: states, overlays, actions |
| `src/lib/sample-listings.ts` | Sample data + the `Listing` / `Source` / `Status` types |

To replicate elsewhere: copy `styles.css` tokens, the type definitions, and the card component. The page layout is mechanical once tokens are in place.

---

## 14. Open extension points (not yet built)

- Light-mode toggle UI (the `.light` palette already exists).
- Price-history sparkline on cards (data tracked, visualization TBD — keep it monochrome `--muted-foreground` with a `--primary` endpoint dot).
- Shortlist side-by-side compare view at `/compare`.
- Per-source price diff chip when the same car is cross-posted at different prices (small inline `±$X` in `--warning` next to the multi-source line).
- Skeleton loader for the card (use `surface-2` blocks at the same geometry; no shimmer).
