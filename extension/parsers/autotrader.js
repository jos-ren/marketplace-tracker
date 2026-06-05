// parsers/autotrader.js — AutoTrader.ca search-results parser.
//
// AutoTrader.ca exposes clean structured data as data-* attributes directly on
// each listing's <article>, so we anchor on those (stable) rather than the
// hashed CSS-module class names (e.g. ListItem_title__ndA4s) which rotate per
// build. Note: mileage is in KM on .ca — we store the raw odometer number.

(function () {
  window.vtParsers = window.vtParsers || {};

  // "$ 7,000" -> 7000, "249,000 km" -> 249000, "unknown" -> null
  function intOrNull(v) {
    if (v === null || v === undefined) return null;
    const digits = String(v).replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : null;
  }

  function cap(s) {
    return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function matches(hostname) {
    return hostname.includes("autotrader");
  }

  function findCards(root) {
    return root.querySelectorAll('article[data-testid="list-item"]');
  }

  function parseCard(el) {
    const id = el.dataset.guid || el.id || null;
    if (!id) return null; // can't dedupe without an ID

    const anchor = el.querySelector(
      'a[data-anchor-overlay], a[href*="/offers/"], a[href*="/a/"]'
    );
    const url = anchor ? anchor.href : null;

    // price: prefer the data attribute, fall back to the rendered price text
    let price = intOrNull(el.dataset.price);
    if (price === null) {
      const priceEl = el.querySelector('[data-testid="regular-price"]');
      if (priceEl) price = intOrNull(priceEl.textContent);
    }

    const year = intOrNull(el.dataset.modelYear);
    const mileage = intOrNull(el.dataset.mileage); // KM on .ca

    // make_model: prefer the proper-cased title text, fall back to data attrs.
    // The <h2>'s first span is "<year> <Make> <Model>"; strip the leading year.
    let makeModel = null;
    const boldSpan = el.querySelector("h2 span");
    if (boldSpan) {
      makeModel = boldSpan.textContent.replace(/^\s*\d{4}\s*/, "").trim() || null;
    }
    if (!makeModel && el.dataset.make) {
      makeModel =
        cap(el.dataset.make) +
        (el.dataset.model ? " " + cap(el.dataset.model) : "");
    }

    // title: join the <h2> span texts -> "2003 Honda Element Y Pkg"
    let title = null;
    const h2 = el.querySelector("h2");
    if (h2) {
      title =
        Array.from(h2.querySelectorAll("span"))
          .map((s) => s.textContent.trim())
          .filter(Boolean)
          .join(" ")
          .trim() || null;
    }
    if (!title) {
      const labelled = el.querySelector("a[aria-label]");
      if (labelled) title = labelled.getAttribute("aria-label") || null;
    }
    if (!title && (year || makeModel)) {
      title = [year, makeModel].filter(Boolean).join(" ") || null;
    }

    // photo
    let photo = null;
    const img = el.querySelector(
      'img[data-testid="list-gallery-image"], picture img, img'
    );
    if (img && img.src && !img.src.startsWith("data:")) photo = img.src;

    // location: best-effort "City, PROV". Scan the card's spans for a Canadian
    // province-coded place rather than depending on the seller/dealer wrapper
    // class (private vs dealer cards use different markup). Strip the trailing
    // "• N km from you" distance before matching.
    let location = null;
    const LOC_RE =
      /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.'’\- ]*,\s*(?:BC|AB|SK|MB|ON|QC|NB|NS|PE|NL|YT|NT|NU))\b/;
    for (const span of el.querySelectorAll("span")) {
      const txt = span.textContent.split("•")[0].trim();
      const m = txt.match(LOC_RE);
      if (m) {
        location = m[1].trim();
        break;
      }
    }

    return {
      source: "autotrader",
      external_id: id,
      url: url || null,
      title: title,
      price: price,
      year: year,
      make_model: makeModel,
      mileage: mileage,
      location: location,
      photo_url: photo,
    };
  }

  window.vtParsers.autotrader = { matches, findCards, parseCard };
})();
