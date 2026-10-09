-- A line can be priced for the second tier only (Clare Hall: a student's guest at formal has a Student price and no
-- Senior one), so the first price may be empty; a line still needs one or the other.
alter table venue_prices alter column price_gbp drop not null;
alter table venue_prices add constraint venue_prices_priced check (price_gbp is not null or non_member_gbp is not null);
