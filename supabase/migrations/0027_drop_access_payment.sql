-- Who can eat at a venue, and how to pay there, are no longer kept. Most of it came from visitors' reports dating
-- 2015–2026 or notes without a source, and the member/guest and card rules are much the same at every college. If
-- either comes back, it's from each venue's own page. The old values are in data/colleges/*.yaml at d9ed8c1 and in
-- migrations 0004, 0009, 0014 and 0016.
alter table venues drop column access, drop column payment;
