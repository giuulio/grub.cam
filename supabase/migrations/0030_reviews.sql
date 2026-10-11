-- Reviews, 12 October 2026: a signed-in Cambridge member rates a venue out of 5, with a few words if they like. One
-- review per member per venue, which they can change or take back. Written only through the `submit` function, which
-- checks any text (OpenAI's moderation, then a small model asking whether it's about the venue and names or attacks
-- no one) before it's shown: a rating alone, or text that passes, is `published`; text that doesn't, or arrives when
-- no model can look, waits for a person (`needs_review`, `npm run reviews`). `hidden` is a person taking one down.
--
-- Shown anonymously ("Cambridge member", the month), and only for a venue with at least 5 published: the two public
-- views below hold nothing for a venue with fewer, so neither the average nor the words can be read before then.

create table reviews (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 1000),
  status text not null default 'published' check (status in ('published', 'needs_review', 'hidden')),
  review_note text,                               -- why it waits or was hidden, for the person who looks
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, user_id)
);
create index reviews_venue_idx on reviews(venue_id, status, updated_at desc);
create index reviews_user_idx on reviews(user_id, updated_at desc);

alter table reviews enable row level security;
-- A member reads their own (to change it); everything else goes through the views or the service role
create policy "own reviews" on reviews for select to authenticated using (user_id = auth.uid());

-- The venues with at least 5 published reviews, their count and average: what the site shows
create view venue_ratings with (security_invoker = false) as
  select venue_id, count(*)::int as reviews, round(avg(rating)::numeric, 2)::float8 as average
  from reviews
  where status = 'published'
  group by venue_id
  having count(*) >= 5;

-- Their published reviews, without who wrote them
create view venue_reviews with (security_invoker = false) as
  select r.id, r.venue_id, r.rating, r.body, r.created_at, r.updated_at
  from reviews r
  join venue_ratings v using (venue_id)
  where r.status = 'published';

grant select on venue_ratings, venue_reviews to anon, authenticated;
comment on view venue_ratings is 'Published reviews per venue, count and average, only where there are at least 5.';
comment on view venue_reviews is 'Published reviews of venues with at least 5, anonymous.';

-- The model calls that checked a review
alter table model_calls add column review_id uuid references reviews(id) on delete set null;
