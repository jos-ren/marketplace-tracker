// parsers/kijiji.js — Kijiji.ca search-results parser (list view).
//
// Kijiji uses stable data-testid hooks. Automotive listings are marked by a
// [data-testid="autos-listing-price"] element, so findCards filters to those —
// letting us match all of kijiji.ca without capturing non-vehicle listings.
// Date is RELATIVE ("2 wks ago"), so posted_date here is approximate.
// Note: mileage is KM for Canadian listings — stored as the raw odometer number.

(function () {
  window.vtParsers = window.vtParsers || {};

  function digitsOrNull(v) {
    if (v === null || v === undefined) return null;
    const d = String(v).replace(/[^\d]/g, "");
    return d ? parseInt(d, 10) : null;
  }

  function fmt(dt) {
    return (
      dt.getFullYear() +
      "-" +
      String(dt.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(dt.getDate()).padStart(2, "0")
    );
  }

  // Convert Kijiji's relative date text ("2 wks ago", "Yesterday", "3 days ago")
  // to an approximate "YYYY-MM-DD". Also handles an absolute dd/mm/yyyy fallback.
  function parseRelativeDate(text) {
    const t = (text || "").trim().toLowerCase();
    if (!t) return null;
    const now = new Date();
    const daysAgo = (d) =>
      fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate() - d));

    let m;
    if ((m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/))) {
      return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; // dd/mm/yyyy
    }
    if (/just now|moment|min|hour|\bhr/.test(t)) return daysAgo(0);
    if (/yesterday/.test(t)) return daysAgo(1);
    if ((m = t.match(/(\d+)\s*(?:day|days)\b/))) return daysAgo(parseInt(m[1], 10));
    if ((m = t.match(/(\d+)\s*(?:wk|wks|week|weeks)\b/)))
      return daysAgo(parseInt(m[1], 10) * 7);
    if ((m = t.match(/(\d+)\s*(?:mo|mos|month|months)\b/)))
      return daysAgo(parseInt(m[1], 10) * 30);
    if ((m = t.match(/(\d+)\s*(?:yr|yrs|year|years)\b/)))
      return daysAgo(parseInt(m[1], 10) * 365);
    return null;
  }

  function matches(hostname) {
    return hostname.includes("kijiji");
  }

  // Only automotive cards (those with an autos price element).
  function findCards(root) {
    return Array.from(
      root.querySelectorAll('[data-testid="listing-card"]')
    ).filter((c) => c.querySelector('[data-testid="autos-listing-price"]'));
  }

  function parseCard(el) {
    let id = el.getAttribute("data-listingid");
    const link = el.querySelector('a[data-testid="listing-link"], a[href*="/v-"]');
    if (!id && link) {
      const m = link.href.match(/\/(\d+)(?:\?|$)/);
      if (m) id = m[1];
    }
    if (!id) return null;

    const url = link ? link.href.split("?")[0] : null;

    let title = null;
    const titleEl = el.querySelector('[data-testid="listing-title"]');
    if (titleEl) title = titleEl.textContent.trim() || null;

    const price = digitsOrNull(
      (el.querySelector('[data-testid="autos-listing-price"]') || {}).textContent || ""
    );

    let location = null;
    const locEl = el.querySelector('[data-testid="listing-location"]');
    if (locEl) location = locEl.textContent.trim() || null;

    // posted_date: relative ("2 wks ago") -> approximate date
    let postedDate = null;
    const dateEl =
      el.querySelector('[data-testid="listing-date"]') ||
      el.querySelector('[data-testid="listing-date-mobile"]');
    if (dateEl) postedDate = parseRelativeDate(dateEl.textContent);

    // mileage: best-effort — a card element whose whole text is "<digits> km"
    let mileage = null;
    for (const node of el.querySelectorAll("p, span, li, div")) {
      const m = node.textContent.trim().match(/^([\d][\d,]*)\s*km$/i);
      if (m) {
        mileage = digitsOrNull(m[1]);
        break;
      }
    }

    let year = null;
    let makeModel = null;
    if (title) {
      const ym = title.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
      if (ym) year = parseInt(ym[1], 10);
      makeModel = title.replace(/^\s*\d{4}\s*/, "").trim() || null;
    }

    let photo = null;
    const img = el.querySelector('img[data-testid="listing-card-image"]');
    if (img && img.src && !img.src.startsWith("data:")) photo = img.src;

    return {
      source: "kijiji",
      external_id: id,
      url: url || null,
      title: title,
      price: price,
      year: year,
      make_model: makeModel,
      mileage: mileage,
      location: location,
      photo_url: photo,
      posted_date: postedDate,
    };
  }

  window.vtParsers.kijiji = { matches, findCards, parseCard };
})();
