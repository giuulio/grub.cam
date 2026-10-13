-- A board can come as a PDF too (a college's weekly menu): the bucket takes PDFs, up to 10 MB (photos stay 5 MB, the
-- submit function checks each).
update storage.buckets
set allowed_mime_types = '{image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf}', file_size_limit = 10485760
where id = 'submissions';
