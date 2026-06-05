// parsers/craigslist.js — Craigslist (gallery view) search-results parser.
//
// Craigslist class names are stable/semantic, so we anchor on them directly:
// .cl-search-result[data-pid] cards, .priceinfo, .posting-title, .result-location.
// The odometer is a bare text node inside .meta (between the posted-date and
// location spans), so we scan only direct text nodes — reading the whole .meta
// text would merge "6/2" + "371,000km" into a wrong number.
// Note: mileage is KM for Canadian listings — stored as the raw odometer number.

(function () {
  window.vtParsers = window.vtParsers || {};

  function digitsOrNull(v) {
    if (v === null || v === undefined) return null;
    const d = String(v).replace(/[^\d]/g, "");
    return d ? parseInt(d, 10) : null;
  }

  // Craigslist gallery shows the posted date as "M/D" (no year). Infer the
  // year as the current one, rolling back to last year if that date would be
  // in the future (a post can't be dated ahead of now). Returns "YYYY-MM-DD".
  function parsePostedDate(text) {
    const m = (text || "").trim().match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!m) return null;
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const now = new Date();
    let year = now.getFullYear();
    const candidate = new Date(year, month - 1, day);
    if (candidate.getTime() - now.getTime() > 24 * 60 * 60 * 1000) year -= 1;
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }

  function matches(hostname) {
    return hostname.includes("craigslist");
  }

  function findCards(root) {
    return root.querySelectorAll(".cl-search-result[data-pid]");
  }

  function parseCard(el) {
    const id = el.getAttribute("data-pid");
    if (!id) return null;

    const link = el.querySelector("a.posting-title, a.main, a[href*='.html']");
    const url = link ? link.href.split("?")[0] : null;

    let title =
      (el.querySelector(".posting-title .label") || el.querySelector(".posting-title") || {})
        .textContent || el.getAttribute("title") || "";
    title = title.trim() || null;

    const price = digitsOrNull(
      (el.querySelector(".priceinfo") || {}).textContent || ""
    );

    let location = null;
    const locEl = el.querySelector(".result-location");
    if (locEl) location = locEl.textContent.trim() || null;

    let postedDate = null;
    const dateEl = el.querySelector(".result-posted-date");
    if (dateEl) postedDate = parsePostedDate(dateEl.textContent);

    // mileage: scan the .meta line's direct TEXT nodes only ("371,000km")
    let mileage = null;
    const meta = el.querySelector(".meta");
    if (meta) {
      for (const node of meta.childNodes) {
        if (node.nodeType !== 3) continue; // text nodes only
        const m = node.textContent
          .replace(/,/g, "")
          .match(/([\d.]+)\s*(k)?\s*(km|kms|mi|mile|miles)\b/i);
        if (m) {
          let n = parseFloat(m[1]);
          if (!isNaN(n)) {
            if (m[2]) n *= 1000; // trailing "K"
            mileage = Math.round(n);
            break;
          }
        }
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
    const img = el.querySelector(".cl-gallery img, img");
    if (img && img.src && !img.src.startsWith("data:")) photo = img.src;

    return {
      source: "craigslist",
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

  window.vtParsers.craigslist = { matches, findCards, parseCard };
})();
