-- Hours for venues that had none, 9 October 2026, each from a published source named in its prov and in the venue's
-- hours_text: College pages and PDFs (official), students' union and MCR pages (reported, medium), third-party listings
-- (reported, low). Nothing is projected: where a source gives a day without a time (Girton's Hall and Social Hub, Trinity
-- Hall's cafeteria, King's bar and coffee shop, Emmanuel's bar, the ADC bar, the Judge café) the venue keeps no slot and
-- the note says what is known. Formal hall slots follow the convention of the earlier ones: start as published, end two
-- hours later and noted as unpublished. A café that is a bar by night with one span posted keeps one slot in its own type.

-- Hours stated once, as JSON, so each slot carries where it came from
insert into service_slots (venue_id, site, venue, meal, days, start_time, end_time, period, note, prov)
select s.venue_id, split_part(s.venue_id, '/', 1), split_part(s.venue_id, '/', 2), s.meal, s.days::text[], s.start_time::time, s.end_time::time, s.period, s.note,
  jsonb_build_object('confidence', s.confidence, 'source_kind', s.source_kind, 'observed_at', '2026-10-09', 'source_url', s.source_url)
from (values
  -- Clare: the UCS handbook and "Life in Cambridge" page give the Buttery's times; the College page adds Sunday dinner.
  ('clare/buttery', 'breakfast', '{mon,tue,wed,thu,fri}', '08:00', '09:00', 'term', null, 'medium', 'reported', 'https://ucs.clare.cam.ac.uk/current-students/life-in-cambridge/'),
  ('clare/buttery', 'lunch', '{mon,tue,wed,thu,fri}', '12:30', '13:30', 'term', null, 'medium', 'reported', 'https://ucs.clare.cam.ac.uk/current-students/life-in-cambridge/'),
  ('clare/buttery', 'dinner', '{mon,tue,wed,thu,fri,sat,sun}', '18:15', '19:15', 'term', 'Sunday from the College page; the UCS lists Mon–Sat', 'medium', 'reported', 'https://ucs.clare.cam.ac.uk/current-students/life-in-cambridge/'),
  ('clare/buttery', 'brunch', '{sat}', '12:30', '13:30', 'term', null, 'medium', 'reported', 'https://ucs.clare.cam.ac.uk/current-students/life-in-cambridge/'),
  ('clare/hall', 'formal', '{mon,tue,wed,thu,fri}', '19:30', '21:30', 'term', 'Mon–Thu undergraduate formal (arrive by 19:20), Fri MCR formal; end not published (about two hours)', 'medium', 'reported', 'https://ucs.clare.cam.ac.uk/current-students/life-in-cambridge/'),
  ('clare/river-room', 'snacks', '{mon,tue,wed,thu,fri}', '09:00', '18:00', 'all', 'UCS Disability at Clare handbook 2026-27; vacation hours not stated', 'medium', 'reported', 'https://ucs.clare.cam.ac.uk/disability-at-clare-handbook/'),
  ('clare/cellars', 'bar', '{mon,tue,wed,thu,fri,sat,sun}', '19:00', '23:00', 'term', 'student-run; "7–11pm every day" on its site, term time per the UCS', 'medium', 'official', 'https://www.clarecellars.org/'),
  -- Corpus: the College's Catering Operational Timings poster for Lent 2026, still the one on its food page
  ('corpus-christi/pelican-bar', 'bar', '{mon,wed}', '09:30', '22:30', 'term', 'café by day, bar in the evening; Lent 2026 timetable, the latest posted', 'medium', 'official', 'https://www.corpus.cam.ac.uk/sites/default/files/term_timings_lent_2026.jpg'),
  ('corpus-christi/pelican-bar', 'bar', '{tue,thu}', '10:00', '22:30', 'term', 'café by day, bar in the evening; Lent 2026 timetable, the latest posted', 'medium', 'official', 'https://www.corpus.cam.ac.uk/sites/default/files/term_timings_lent_2026.jpg'),
  ('corpus-christi/pelican-bar', 'bar', '{fri}', '09:30', '23:00', 'term', 'café by day, bar in the evening; Lent 2026 timetable, the latest posted', 'medium', 'official', 'https://www.corpus.cam.ac.uk/sites/default/files/term_timings_lent_2026.jpg'),
  ('corpus-christi/pelican-bar', 'bar', '{sat}', '17:30', '22:30', 'term', 'Lent 2026 timetable, the latest posted', 'medium', 'official', 'https://www.corpus.cam.ac.uk/sites/default/files/term_timings_lent_2026.jpg'),
  ('corpus-christi/pelican-bar', 'bar', '{sun}', '18:30', '22:30', 'term', 'Lent 2026 timetable, the latest posted', 'medium', 'official', 'https://www.corpus.cam.ac.uk/sites/default/files/term_timings_lent_2026.jpg'),
  ('corpus-christi/leckhampton-dining-hall', 'dinner', '{wed,thu,fri}', '19:00', '20:00', 'term', 'cafeteria; Tuesday is a booked two-course sit-down dinner, time not posted; Lent 2026 timetable', 'medium', 'official', 'https://www.corpus.cam.ac.uk/sites/default/files/term_timings_lent_2026.jpg'),
  ('corpus-christi/leckhampton-bar', 'bar', '{tue,wed,thu,fri,sat}', '19:00', '23:00', 'all', 'student-run; "operates throughout the year, Tuesdays to Saturdays" (handbook 2025); Lent 2026 timetable', 'medium', 'official', 'https://www.corpus.cam.ac.uk/sites/default/files/term_timings_lent_2026.jpg'),
  -- Caius: two sittings Sunday to Friday; lunch and the Saturday brunch have no published times
  ('gonville-and-caius/hall', 'dinner', '{sun,mon,tue,wed,thu,fri}', '18:00', '19:15', 'term', 'First Hall, a served three-course sitting before Second Hall at 19:20; Saturday cafeteria dinner, time not published', 'medium', 'official', 'https://www.cai.cam.ac.uk/living-here/food-and-drink/hall'),
  ('gonville-and-caius/hall', 'formal', '{sun,mon,tue,wed,thu,fri}', '19:20', '21:20', 'term', 'Second Hall; end not published (about two hours)', 'medium', 'official', 'https://www.cai.cam.ac.uk/living-here/food-and-drink/hall'),
  ('gonville-and-caius/old-courts-cafe-bar', 'snacks', '{mon,tue,wed,thu,fri}', '08:00', '17:00', 'term', 'café hours from the MCR glossary, days not stated; the bar opens every night, times not published', 'low', 'reported', 'https://mcr.cai.cam.ac.uk/index.php/new/cambridge-speak-decoded/'),
  -- St John's: the Johnian pages give the Café and Bar hours and the Hall dinner times
  ('st-johns/cafe', 'snacks', '{mon,tue,wed,thu,fri}', '08:00', '17:00', 'all', 'normal hours; vary with term and holidays', 'medium', 'official', 'https://johnian.joh.cam.ac.uk/alumni-benefits/'),
  ('st-johns/cafe', 'snacks', '{sat,sun}', '08:30', '17:00', 'all', 'normal hours; vary with term and holidays', 'medium', 'official', 'https://johnian.joh.cam.ac.uk/alumni-benefits/'),
  ('st-johns/hall', 'formal', '{tue,wed,thu,fri}', '19:30', '21:30', 'term', '150 tickets five nights a week, not Monday or Saturday; end not published (about two hours)', 'medium', 'official', 'https://johnian.joh.cam.ac.uk/wp-content/uploads/2025/09/Johnian-Dining-Information-2025-26.pdf'),
  ('st-johns/hall', 'formal', '{sun}', '19:45', '21:45', 'term', 'Sunday dinner starts later; end not published (about two hours)', 'medium', 'official', 'https://johnian.joh.cam.ac.uk/wp-content/uploads/2025/09/Johnian-Dining-Information-2025-26.pdf'),
  -- Magdalene: the student guide's meal times and the Code of Practice for Dinner in Hall
  ('magdalene/hall', 'formal', '{tue,thu,fri,sun}', '19:30', '21:30', 'term', 'Tue, Thu, Sun undergraduate formal; Fri graduate table; doors shut at 19:30; end not published (about two hours)', 'medium', 'official', 'https://www.magd.cam.ac.uk/sites/default/files/2025-04/student_guide_2024-25.pdf'),
  -- Newnham: formal nights from the College's dining pages, bar hours from the Bar and Party Room Rules (February 2025)
  ('newnham/clough-hall', 'formal', '{tue,wed,thu}', '19:30', '21:30', 'term', 'Thu Formal Hall, Tue Postgraduate Formal, Wed Subject Formal (no guests); doors close 19:30; end not published (about two hours)', 'medium', 'official', 'https://newn.cam.ac.uk/privileges-dining'),
  ('newnham/iris-bar', 'bar', '{mon,tue,wed,thu,fri,sat}', '18:30', '23:00', 'term', 'student-run in term; 23:30 with an extension', 'medium', 'official', 'https://newn.cam.ac.uk/sites/default/files/2025-02/Bar%20and%20Party%20Room%20Rules%20.pdf'),
  ('newnham/iris-bar', 'bar', '{sun}', '19:00', '22:30', 'term', 'student-run in term', 'medium', 'official', 'https://newn.cam.ac.uk/sites/default/files/2025-02/Bar%20and%20Party%20Room%20Rules%20.pdf'),
  -- Queens': Formal Friday in Old Hall per the JCR prospectus; the College's formals start at 19:30
  ('queens/old-hall', 'formal', '{fri}', '19:30', '21:30', 'term', 'Formal Friday (JCR prospectus 2025); start taken from the College''s other formals; end not published (about two hours)', 'low', 'reported', 'https://qjcr.org.uk/content/Queens%27-Alternative-Prospectus-2025-1.pdf'),
  -- Hughes Hall: the MCR's bar, from the College's MCR page
  ('hughes-hall/mcr-clubroom', 'bar', '{sun,mon,tue,wed,thu}', '20:00', '23:00', 'term', 'The Nobel Laureate', 'medium', 'official', 'https://www.hughes.cam.ac.uk/student-centre/hughes-hall-mcr/mcr-resources-forms-and-documents/'),
  ('hughes-hall/mcr-clubroom', 'bar', '{fri,sat}', '20:00', '00:00', 'term', 'The Nobel Laureate', 'medium', 'official', 'https://www.hughes.cam.ac.uk/student-centre/hughes-hall-mcr/mcr-resources-forms-and-documents/'),
  -- Peterhouse: the College's bar page
  ('peterhouse/whittle-building-bar', 'bar', '{sun,mon,tue,wed,thu}', '19:00', '23:00', 'term', null, 'medium', 'official', 'https://www.pet.cam.ac.uk/bar'),
  ('peterhouse/whittle-building-bar', 'bar', '{fri,sat}', '19:00', '00:00', 'term', 'until midnight in Michaelmas and Lent, 23:00 in Easter Term', 'medium', 'official', 'https://www.pet.cam.ac.uk/bar'),
  -- Trinity: the BA Society guide (2018) is the last published statement of the Bar & Coffee Shop's hours; Varsity (2024) confirms the 23:00 bell
  ('trinity/bar', 'bar', '{sun,mon,tue,wed,thu}', '10:00', '23:00', 'term', 'coffee shop by day, bar in the evening; reported 2018, closing confirmed 2024', 'low', 'reported', 'https://www.readkong.com/page/trinity-college-ba-society-rough-guide-2018-7084019'),
  ('trinity/bar', 'bar', '{fri,sat}', '10:00', '23:30', 'term', 'coffee shop by day, bar in the evening; reported 2018', 'low', 'reported', 'https://www.readkong.com/page/trinity-college-ba-society-rough-guide-2018-7084019'),
  -- Christ's: breakfast is served in the Buttery (JCR meal times); the College's hospitality guide gives its opening hours
  ('christs/buttery', 'breakfast', '{mon,tue,wed,thu,fri}', '08:00', '09:30', 'term', null, 'medium', 'reported', 'https://thejcr.co.uk/resources'),
  ('christs/buttery', 'snacks', '{mon,tue,wed,thu,fri,sat}', '10:00', '23:00', 'all', 'café by day, bar in the evening; the handover time is not published', 'medium', 'official', 'https://christscollegehospitality.co.uk/guide-book/christs-college/'),
  ('christs/buttery', 'snacks', '{sun}', '10:00', '22:00', 'all', 'café by day, bar in the evening; the handover time is not published', 'medium', 'official', 'https://christscollegehospitality.co.uk/guide-book/christs-college/'),
  -- Darwin: the bar's own site, this week's hours (its normal pattern); the College says 21:00–23:59 every evening
  ('darwin/darbar', 'bar', '{mon,tue,sun}', '20:00', '23:00', 'all', 'student-run; hours posted weekly on bar.dar.cam.ac.uk (week of 5 Oct 2026)', 'medium', 'official', 'https://bar.dar.cam.ac.uk/'),
  ('darwin/darbar', 'bar', '{wed,thu,fri,sat}', '21:00', '00:00', 'all', 'student-run; hours posted weekly on bar.dar.cam.ac.uk (week of 5 Oct 2026)', 'medium', 'official', 'https://bar.dar.cam.ac.uk/'),
  -- Jesus: the Roost Café and the Brewery Room below it, "typical hours" from the College's guest information
  ('jesus/the-roost', 'snacks', '{mon}', '09:00', '16:00', 'all', 'Roost Café; typical hours', 'medium', 'official', 'https://www.jesus.cam.ac.uk/conferences-and-events/accommodation/guest-information'),
  ('jesus/the-roost', 'snacks', '{tue,wed,thu,fri}', '09:00', '17:00', 'all', 'Roost Café; typical hours', 'medium', 'official', 'https://www.jesus.cam.ac.uk/conferences-and-events/accommodation/guest-information'),
  ('jesus/the-roost', 'snacks', '{sat}', '10:00', '14:00', 'term', 'Roost Café; typical hours', 'medium', 'official', 'https://www.jesus.cam.ac.uk/conferences-and-events/accommodation/guest-information'),
  ('jesus/the-roost', 'bar', '{tue,wed,thu,fri}', '17:00', '23:00', 'all', 'Brewery Room, the bar below the Roost; typical hours', 'medium', 'official', 'https://www.jesus.cam.ac.uk/conferences-and-events/accommodation/guest-information'),
  ('jesus/the-roost', 'bar', '{sat,sun}', '18:00', '23:00', 'all', 'Brewery Room, the bar below the Roost; typical hours', 'medium', 'official', 'https://www.jesus.cam.ac.uk/conferences-and-events/accommodation/guest-information'),
  -- Trinity Hall: the Coffee Shop's hours from the College's alumni page; the Aula Bar opens at 18:00 but its closing time isn't published
  ('trinity-hall/aula', 'snacks', '{mon,tue,wed,thu,fri}', '09:30', '18:00', 'term', 'Coffee Shop; days not stated; the Aula Bar follows from 18:00, closing time not published', 'medium', 'official', 'https://www.trinhall.cam.ac.uk/alumni/alumni-benefits/'),
  ('trinity-hall/aula', 'snacks', '{mon,tue,wed,thu,fri}', '10:00', '15:00', 'vacation', 'Coffee Shop; "approximately 10am to 3pm", check with the Porters', 'low', 'official', 'https://www.trinhall.cam.ac.uk/alumni/alumni-benefits/'),
  -- King's: breakfast and brunch from the College's guest-accommodation listing; lunch and dinner as reported in 2023
  ('kings/servery-dining-hall', 'breakfast', '{mon,tue,wed,thu,fri}', '08:00', '09:15', 'all', 'as served to guests staying in College', 'medium', 'official', 'https://www.universityrooms.com/en-GB/city/cambridge/college/kingscollege'),
  ('kings/servery-dining-hall', 'brunch', '{sat,sun}', '10:30', '13:30', 'all', 'as served to guests staying in College', 'medium', 'official', 'https://www.universityrooms.com/en-GB/city/cambridge/college/kingscollege'),
  ('kings/servery-dining-hall', 'lunch', '{mon,tue,wed,thu,fri}', '12:15', '13:30', 'all', 'reported 2023', 'low', 'reported', 'https://ssb22.user.srcf.net/buttery.html'),
  ('kings/servery-dining-hall', 'dinner', '{mon,tue,wed,thu,fri,sat,sun}', '18:00', '19:30', 'term', 'reported 2023', 'low', 'reported', 'https://ssb22.user.srcf.net/buttery.html'),
  ('kings/servery-dining-hall', 'dinner', '{mon,tue,wed,thu,fri,sat,sun}', '18:00', '19:00', 'vacation', 'reported 2023', 'low', 'reported', 'https://ssb22.user.srcf.net/buttery.html'),
  -- West Cambridge: Aristocaters publishes no hours of its own; two listings agree
  ('west-cambridge/aristocaters-cafe', 'snacks', '{mon,tue,wed,thu,fri}', '09:00', '15:00', 'all', 'from map listings; the café''s own site has no hours', 'low', 'reported', 'https://cafe-restaurant-bar.uk/cambridge/aristocaters-cafe/')
) as s(venue_id, meal, days, start_time, end_time, period, note, confidence, source_kind, source_url);

-- St John's Bar: the College's published hours replace the Google Maps ones
delete from service_slots where venue_id = 'st-johns/bar';
insert into service_slots (venue_id, site, venue, meal, days, start_time, end_time, period, note, prov)
select 'st-johns/bar', 'st-johns', 'bar', 'bar', s.days::text[], s.start_time::time, s.end_time::time, 'all', 'normal hours; may be extended for College events',
  '{"confidence": "medium", "source_kind": "official", "observed_at": "2026-10-09", "source_url": "https://johnian.joh.cam.ac.uk/alumni-benefits/"}'::jsonb
from (values ('{mon,tue,wed,thu}', '16:30', '23:00'), ('{fri}', '16:30', '00:00'), ('{sat}', '15:00', '23:00'), ('{sun}', '15:00', '22:30')) as s(days, start_time, end_time);

-- Formal days now carried by slots (formals.days is for when the start time isn't published)
update formals set days = null where venue_id in ('queens/old-hall', 'st-johns/hall');

-- The notes follow the slots, and say what is still unknown
update venues v set hours_text = t.text from (values
  ('clare/buttery', 'term: Mon–Fri 08:00–09:00 breakfast, 12:30–13:30 lunch; Sat 12:30–13:30 brunch; 18:15–19:15 dinner Mon–Sat (UCS) and Sun (College page) [UCS Life in Cambridge; Disability handbook 2026-27]'),
  ('clare/hall', 'formal 19:30 Mon–Thu for undergraduates (arrive by 19:20; £13.00, guest £28.00) and Fri for the MCR, in term [UCS Life in Cambridge; MCR Freshers Guide 2025-26]'),
  ('clare/river-room', 'Mon–Fri 09:00–18:00 [UCS Disability at Clare handbook 2026-27]; vacation hours not stated'),
  ('clare/cellars', 'daily 19:00–23:00 in term, student-run [clarecellars.org; UCS guide]'),
  ('corpus-christi/pelican-bar', 'Lent 2026 timetable (the latest the College has posted, Oct 2026): Mon, Wed 09:30–22:30; Tue, Thu 10:00–22:30; Fri 09:30–23:00; Sat 17:30–22:30; Sun 18:30–22:30. Café by day, bar in the evening; study space 24/7'),
  ('corpus-christi/leckhampton-dining-hall', 'Lent 2026 timetable: cafeteria dinner Wed–Fri 19:00–20:00; Tue two-course sit-down dinner (booked on UPay, time not posted); closed Sat–Mon'),
  ('corpus-christi/leckhampton-bar', 'Tue–Sat 19:00–23:00, all year, student-run [Lent 2026 timetable; handbook 2025]'),
  ('gonville-and-caius/hall', 'Sun–Fri: First Hall 18:00 (served, three courses), Second/Formal Hall 19:20; Sat cafeteria dinner; Mon–Fri cafeteria lunch and Sat brunch, times not published [College Hall page]'),
  ('gonville-and-caius/old-courts-cafe-bar', 'café 08:00–17:00 (MCR glossary, days not stated; also serves breakfast); bar every night, times not published [College bar page]'),
  ('st-johns/cafe', 'normal hours: Mon–Fri 08:00–17:00; Sat–Sun 08:30–17:00; vary with term and holidays [Johnian alumni benefits]'),
  ('st-johns/bar', 'normal hours: Mon–Thu 16:30–23:00; Fri 16:30–00:00; Sat 15:00–23:00; Sun 15:00–22:30, may be extended for College events [Johnian alumni benefits]; Google Maps (Oct 2026) shows Mon–Fri 17:00–23:00, Sat 12:30–23:00, Sun 12:30–22:30'),
  ('st-johns/hall', 'formal hall five nights a week in term, not Mon or Sat: dinner 19:30 Tue–Fri, 19:45 Sun; 150 tickets [College food page; Johnian Dining Information 2025-26]'),
  ('magdalene/hall', 'formal 19:30 Tue, Thu, Sun for undergraduates and Fri graduate table, in Full Term; doors shut at 19:30 [student guide 2024-25; Code of Practice for Dinner in Hall]'),
  ('newnham/clough-hall', 'formal 19:30 in term: Thu Formal Hall, Tue Postgraduate Formal, Wed Subject Formal (no guests); be in Hall by 19:15, doors close 19:30 [privileges-dining; JCR; ticket policy 2025]'),
  ('newnham/iris-bar', 'term: Mon–Sat 18:30–23:00 (23:30 with an extension), Sun 19:00–22:30; the room is the Iris Café 08:00–18:00 [Bar and Party Room Rules, Feb 2025]'),
  ('queens/old-hall', 'Formal Friday in term [JCR prospectus 2025]; start taken as 19:30 like the College''s Cripps formals; MCR guest nights here 2–3 times a term, 19:30'),
  ('hughes-hall/mcr-clubroom', 'term: Sun–Thu 20:00–23:00; Fri–Sat 20:00–00:00 (The Nobel Laureate) [College MCR page]'),
  ('peterhouse/whittle-building-bar', 'term: daily 19:00–23:00; Fri–Sat until midnight in Michaelmas and Lent [College bar page]'),
  ('trinity/bar', 'coffee shop by day, bar in the evening; Sun–Thu 10:00–23:00, Fri–Sat 10:00–23:30 in term [BA Society Rough Guide 2018]; closes 23:00 with a bell [Varsity 2024]; not reconfirmed by the College'),
  ('christs/buttery', 'Mon–Sat 10:00–23:00, Sun 10:00–22:00 [College hospitality guide]; breakfast Mon–Fri 08:00–09:30 [JCR meal times]; café by day, bar in the evening, handover time not published'),
  ('darwin/darbar', 'student-run; posted weekly on bar.dar.cam.ac.uk: week of 5 Oct 2026 Mon, Tue, Sun 20:00–23:00, Wed–Sat 21:00–00:00 ("either 8–11 or 9–12"); College: 21:00–23:59 every evening, last orders 23:40'),
  ('jesus/the-roost', 'typical hours: Roost Café Mon 09:00–16:00, Tue–Fri 09:00–17:00, Sat 10:00–14:00 (term), Sun closed; Brewery Room (bar below) Tue–Fri 17:00–23:00, Sat–Sun 18:00–23:00, Mon closed; card only [College guest information]'),
  ('trinity-hall/aula', 'Coffee Shop 09:30–18:00 in Full Term (days not stated), about 10:00–15:00 in vacations [alumni benefits]; Aula Bar from 18:00 in Full Term, closing time not published [MCR]'),
  ('trinity-hall/cafeteria', 'daily lunch and dinner in term; breakfast (JCR says Easter term only); Sun brunch. Times on the intranet. Formal Hall Thu and Sun, time not published [new undergraduates 2026]'),
  ('kings/servery-dining-hall', 'breakfast Mon–Fri 08:00–09:15, brunch Sat–Sun 10:30–13:30 [University Rooms listing]; lunch 12:15–13:30, dinner 18:00–19:30 (19:00 outside term) [reported 2023]; the College publishes times on its intranet'),
  ('kings/college-bar', 'not published outside the College intranet'),
  ('kings/coffee-shop', 'not published outside the College intranet'),
  ('emmanuel/bar', 'student-run, every evening; 20:30–23:30 before the move to Furness Lodge (2020 guide); current times not published'),
  ('girton/hall-cafeteria', 'weekly times by internal newsletter; Formal Hall Thu in term (pre-dinner drinks 18:45 for postgraduates; internal £16, guest about £24) [MCR Freshers Guide 2026]'),
  ('girton/social-hub', 'café by day, bar in the evening; times by internal newsletter [MCR Freshers Guide 2026]'),
  ('west-cambridge/aristocaters-cafe', 'Mon–Fri 09:00–15:00 [map listings, Oct 2026]; the café''s own site has no hours'),
  ('old-addenbrookes/judge-cafe', 'not published; a map listing shows 08:00–18:00 on a weekday (Oct 2026)')
) as t(id, text) where v.id = t.id;
