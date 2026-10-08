-- 0009 replaced the Art Café's hours note with the older College-page hours, after its slots had been set from
-- the posted Michaelmas timetable. The note follows the slots again.
update venues set hours_text = 'Term (28.9.26–4.12.26): café Mon–Fri 08:30–18:00, Sat–Sun 10:00–18:00; student-run bar Mon–Sun 18:00–23:00 [noticeboard photo 2026-10-08]. The College page''s public hours (Mon–Fri 08:30–17:00; Sat–Sun 09:00–17:00) are older'
where id = 'murray-edwards/art-cafe';
