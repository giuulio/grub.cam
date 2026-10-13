-- A member's price list can name the venue's price columns ("columns: Full price | SFC rate", saved as
-- venues.price_terms.tiers). When it renames them, the venue's terms before are kept here as {"before": ...}, so
-- rejecting it puts them back along with the rows in `replaced`.
alter table submissions add column replaced_terms jsonb;
