import type { Listing } from "./types";

// Known passenger-vehicle manufacturers. Curated to CAR/TRUCK brands sold in the
// Canadian market — including ones still common in the USED market (Pontiac,
// Saturn, Scion, Mercury, Suzuki, Hummer, Saab, Daewoo, Datsun) and newer EV
// makers (Tesla, Rivian, Lucid, Polestar, Genesis, Fisker, VinFast). Pure
// motorcycle/powersport brands (Yamaha, Kawasaki, …) are intentionally excluded.
// Common aliases are included (chevy, vw, mercedes/benz, range rover).
export const VEHICLE_BRANDS = [
  "acura", "alfa romeo", "aston martin", "audi", "bentley", "bmw", "bugatti",
  "buick", "cadillac", "chevrolet", "chevy", "chrysler", "daewoo", "datsun",
  "dodge", "ferrari", "fiat", "fisker", "ford", "genesis", "geo", "gmc",
  "honda", "hummer", "hyundai", "infiniti", "isuzu", "jaguar", "jeep", "kia",
  "lamborghini", "land rover", "range rover", "lexus", "lincoln", "lotus",
  "lucid", "maserati", "maybach", "mazda", "mclaren", "mercedes-benz",
  "mercedes", "benz", "mercury", "mini", "mitsubishi", "nissan", "oldsmobile",
  "plymouth", "polestar", "pontiac", "porsche", "ram", "rivian", "rolls-royce",
  "saab", "saturn", "scion", "subaru", "suzuki", "tesla", "toyota",
  "volkswagen", "vw", "volvo", "vinfast",
];

const BRAND_RE = new RegExp(
  "\\b(" +
    VEHICLE_BRANDS.map((b) => b.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|") +
    ")\\b",
  "i"
);

// Parts/accessories keywords. Used as a backstop for listings that DO carry a
// brand (e.g. "Honda Element exhaust") but aren't actually a vehicle.
const PART_KEYWORDS =
  /\b(exhaust|engine|motor|transmission|tranny|tire|tires|rim|rims|wheel|wheels|bumper|hood|fender|door|doors|seat|seats|headlight|headlights|taillight|taillights|muffler|catalytic|alternator|starter|radiator|brakes?|axle|differential|harness|tailgate|mirror|windshield|hubcap|parts?)\b/i;

// Content-based heuristic to tell an actual vehicle from a part/accessory.
// A recognized brand is required; real car listings essentially always have an
// odometer or a model year; the parts keywords catch brand-bearing parts.
export function isVehicle(
  l: Pick<Listing, "title" | "make_model" | "mileage" | "year">
): boolean {
  const text = `${l.title ?? ""} ${l.make_model ?? ""}`;
  if (!BRAND_RE.test(text)) return false; // no recognized brand -> not a vehicle
  if (PART_KEYWORDS.test(text) && l.mileage == null) return false; // brand-bearing part
  return l.mileage != null || l.year != null;
}
