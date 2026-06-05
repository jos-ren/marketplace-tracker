// parsers/facebook.js — Facebook Marketplace search-results parser.
//
// FB class names are obfuscated and rotate, so we NEVER select by class. We
// anchor on structure: each card is an <a href*="/marketplace/item/{id}/">.
// The ID + canonical URL come from the href; the title (and a backup price)
// come from the anchor's aria-label; price / mileage / location are classified
// from the visible text lines by PATTERN, not position, so the parser survives
// reordering or missing fields. Defensive throughout: partial objects over null.
// Note: mileage is KM for Canadian listings — stored as the raw odometer number.

(function () {
  window.vtParsers = window.vtParsers || {};

  function matches(hostname) {
    return hostname.includes("facebook");
  }

  function findCards(root) {
    return root.querySelectorAll('a[href*="/marketplace/item/"]');
  }

  function digitsOrNull(v) {
    if (v === null || v === undefined) return null;
    const d = String(v).replace(/[^\d]/g, "");
    return d ? parseInt(d, 10) : null;
  }

  // "165K km" -> 165000, "45,000 km" -> 45000, "45K miles" -> 45000
  function parseMileage(line) {
    const m = line.replace(/,/g, "").match(/([\d.]+)\s*(k)?\s*(km|kms|mi|mile|miles)\b/i);
    if (!m) return null;
    let n = parseFloat(m[1]);
    if (isNaN(n)) return null;
    if (m[2]) n *= 1000; // trailing "K"
    return Math.round(n);
  }

  function looksLikePrice(line) {
    return /\$/.test(line) && /\d/.test(line);
  }
  function looksLikeMileage(line) {
    return /\b(km|kms|mi|mile|miles)\b/i.test(line) && /\d/.test(line);
  }
  function looksLikeLocation(line) {
    return /,\s*[A-Z]{2}\b/.test(line);
  }

  function parseCard(el) {
    const href = el.getAttribute("href") || "";
    const idMatch = href.match(/\/marketplace\/item\/(\d+)/);
    if (!idMatch) return null; // not a listing card
    const id = idMatch[1];

    const url = `https://www.facebook.com/marketplace/item/${id}/`;
    const aria = el.getAttribute("aria-label") || "";

    // Title: the aria-label starts with the title, up to the first comma.
    // (We avoid splitting the whole label on commas because price "13,500"
    // and location "Burnaby, BC" contain commas too.)
    let title = aria ? aria.split(",")[0].trim() : "";

    // Gather visible text lines from the anchor and classify by pattern.
    let price = null;
    let mileage = null;
    let location = null;
    let titleFromLines = null;

    const seen = new Set();
    for (const span of el.querySelectorAll('span[dir="auto"]')) {
      const line = span.textContent.trim();
      if (!line || seen.has(line)) continue;
      seen.add(line);

      if (price === null && looksLikePrice(line)) {
        price = digitsOrNull(line);
      } else if (mileage === null && looksLikeMileage(line)) {
        mileage = parseMileage(line);
      } else if (location === null && looksLikeLocation(line)) {
        location = line;
      } else if (!titleFromLines) {
        titleFromLines = line;
      }
    }

    if (!title) title = titleFromLines || null;
    if (price === null) price = digitsOrNull((aria.match(/\$\s?[\d,]+/) || [])[0]);

    // year + make_model from the title
    let year = null;
    let makeModel = null;
    if (title) {
      const ym = title.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
      if (ym) year = parseInt(ym[1], 10);
      makeModel = title.replace(/^\s*\d{4}\s*/, "").trim() || null;
    }

    // photo
    let photo = null;
    const img = el.querySelector("img");
    if (img && img.src && !img.src.startsWith("data:")) photo = img.src;

    return {
      source: "facebook",
      external_id: id,
      url: url,
      title: title || null,
      price: price,
      year: year,
      make_model: makeModel,
      mileage: mileage,
      location: location,
      photo_url: photo,
    };
  }

  window.vtParsers.facebook = { matches, findCards, parseCard };
})();
