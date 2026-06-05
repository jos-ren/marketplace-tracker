export type ListingStatus = "new" | "updated" | "seen";

// One row of price_history: a price we observed at a point in time. Handed to a
// card ordered ascending by observed_at (oldest first, newest last).
export type PriceObservation = {
  price: number;
  observed_at: string;
};

export type Listing = {
  id: string;
  source: string;
  external_id: string;
  url: string;
  title: string | null;
  price: number | null;
  year: number | null;
  make_model: string | null;
  mileage: number | null;
  location: string | null;
  photo_url: string | null;
  posted_date: string | null;
  status: ListingStatus;
  saved: boolean;
  first_seen: string;
  last_seen: string;
  view_count: number;
  last_viewed_at: string | null;
};
