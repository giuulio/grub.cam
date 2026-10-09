-- Formal hall prices two colleges publish, 9 October 2026. Clare's are on the UCS "Life in Cambridge" page (member £13.00,
-- guest £28.00, undated but the page is current); Girton's MCR Freshers' Guide 2026 gives the internal price (£16) and only
-- "around £24" for a guest, so the guest price stays unset.
update formals set price_gbp = 13.00, guest_gbp = 28.00, prices_seen = '2026-10-09',
  cost = 'members £13.00, guests £28.00 (UCS Life in Cambridge, read 2026-10-09)',
  url = coalesce(url, 'https://ucs.clare.cam.ac.uk/current-students/life-in-cambridge/')
where venue_id = 'clare/hall';

update formals set price_gbp = 16.00, prices_seen = '2026-09-01',
  cost = 'internal £16; guests "around £24" (MCR Freshers'' Guide 2026)'
where venue_id = 'girton/hall-cafeteria';
