// parsers/cargurus.js — CarGurus.ca search-results parser.
//
// Each tile carries a hidden <dl class="_propertiesList…"> with clean
// Year/Make/Model/Mileage/VIN pairs, plus stable data-testid / data-cg-ft
// hooks. We anchor on those rather than the hashed CSS-module classes.
// Note: mileage is in KM on .ca — we store the raw odometer number.

(function () {
  window.vtParsers = window.vtParsers || {};

  function intOrNull(v) {
    if (v === null || v === undefined) return null;
    const digits = String(v).replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : null;
  }

  function textOf(el, selector) {
    const node = el.querySelector(selector);
    return node ? node.textContent.trim() : null;
  }

  function matches(hostname) {
    return hostname.includes("cargurus");
  }

  function findCards(root) {
    return root.querySelectorAll('[data-testid="srp-listing-tile"]');
  }

  // Read the per-tile <dl> into { year, make, model, mileage, ... }
  function readProps(el) {
    const props = {};
    const dl = el.querySelector("dl");
    if (!dl) return props;
    const dts = dl.querySelectorAll("dt");
    const dds = dl.querySelectorAll("dd");
    for (let i = 0; i < dts.length; i++) {
      const key = dts[i].textContent.replace(/:/g, "").trim().toLowerCase();
      const val = dds[i] ? dds[i].textContent.trim() : "";
      if (key) props[key] = val;
    }
    return props;
  }

  function parseCard(el) {
    const link = el.querySelector(
      'a[data-testid="car-blade-link"], a[href*="/details/"]'
    );

    // external_id: the numeric listing id from /details/<id>
    let id = null;
    if (link) {
      const m = link.href.match(/\/details\/(\d+)/);
      if (m) id = m[1];
    }
    if (!id) {
      const save = el.querySelector("[inventorylistingid]");
      if (save) id = save.getAttribute("inventorylistingid");
    }
    if (!id) return null;

    // url: canonical, query stripped
    const url = link ? link.href.split("?")[0] : null;

    const props = readProps(el);

    const price = intOrNull(textOf(el, '[data-testid="srp-tile-price"]'));

    const year =
      intOrNull(props.year) ||
      (() => {
        const t = textOf(el, '[data-cg-ft="srp-listing-blade-title"]') || "";
        const m = t.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
        return m ? parseInt(m[1], 10) : null;
      })();

    let makeModel =
      [props.make, props.model].filter(Boolean).join(" ").trim() || null;

    // title: prefer the rendered title (proper-cased), fall back to y/m/m
    let title =
      textOf(el, '[data-cg-ft="srp-listing-blade-title"]') ||
      [year, makeModel].filter(Boolean).join(" ") ||
      null;

    if (!makeModel && title) {
      makeModel = title.replace(/^\s*\d{4}\s*/, "").trim() || null;
    }

    const mileage =
      intOrNull(props.mileage) ||
      intOrNull(textOf(el, '[data-testid="srp-tile-mileage"]'));

    // location: "City, PROV" from the location section's title attr / text
    let location = null;
    const locEl = el.querySelector(
      '[data-testid="LocationSection-firstLine"]'
    );
    if (locEl) {
      location = (locEl.getAttribute("title") || locEl.textContent || "").trim() || null;
    }

    let photo = null;
    const img = el.querySelector(
      'img[data-cg-ft="srp-listing-blade-image"], img'
    );
    if (img && img.src && !img.src.startsWith("data:")) photo = img.src;

    return {
      source: "cargurus",
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

  window.vtParsers.cargurus = { matches, findCards, parseCard };
})();
