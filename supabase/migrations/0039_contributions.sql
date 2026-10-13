-- Contribute, 13 October 2026: what a member sends in goes up under their name, as their photos have since 0028, so
-- whoever puts up a wrong menu or a made-up price answers for it, and the /contribute page can rank who has filled in
-- the most. The name is `submissions.credit`, written by the `submit` function when the thing is sent (the name the
-- sender's Cambridge account gives, else their CRSid), under a form that says it will be shown. Two public views, as
-- the reviews' (0030): nothing else of a submission (its email, note, photos or account) can be read through them.

comment on column submissions.credit is 'the name it goes up under, from the sender''s Cambridge account when it was sent; null: not shown';

-- Members' approved submissions that carry a name: the leaderboard and "Just added". `member` keeps one person's rows
-- together (a name can change, or two people share one) without giving out their account's id.
create view contributions with (security_invoker = false) as
  select s.id, s.venue_id, s.kind, s.topic, s.date, s.service, s.credit as author, md5(s.user_id::text) as member,
         s.created_at, coalesce(s.reviewed_at, s.created_at) as published_at
  from submissions s
  where s.status = 'approved' and s.credit is not null and s.user_id is not null;

-- Who sent what a venue's page shows now: its price list, its hours (a list each, so one sender, or a few where hours
-- were added to) and each menu day. Found through what publishing writes: a price list's and a menu's source
-- ("submission <id>: …"), the hours' prov.submission.
create view venue_credits with (security_invoker = false) as
  with credited as (
    select id::text as id, credit as author, coalesce(reviewed_at, created_at) as at
    from submissions
    where status = 'approved' and credit is not null
  )
  select 'prices'::text as what, p.venue_id, null::date as date, null::text as service, c.author, c.at
  from (select distinct venue_id, substring(source from '^submission ([0-9a-f-]{36})') as id from venue_prices) p
  join credited c using (id)
  union all
  select 'hours', s.venue_id, null, null, c.author, c.at
  from (select distinct venue_id, prov->>'submission' as id from service_slots) s
  join credited c using (id)
  union all
  select 'menu', m.venue_id, m.date, m.service, c.author, c.at
  from menu_days m
  join credited c on c.id = substring(m.source_url from '^submission ([0-9a-f-]{36})');

grant select on contributions, venue_credits to anon, authenticated;
comment on view contributions is 'Members'' approved submissions that carry their name: who, what, where and when; no email or account id.';
comment on view venue_credits is 'Who sent the price list, hours and menu days a venue''s page shows now, where a member did.';
