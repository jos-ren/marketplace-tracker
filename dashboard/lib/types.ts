export type ListingStatus = "new" | "viewed" | "shortlisted" | "hidden";

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
  first_seen: string;
  last_seen: string;
  view_count: number;
  last_viewed_at: string | null;
};
