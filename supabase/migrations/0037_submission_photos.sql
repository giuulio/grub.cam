-- A board can take more than one photo (a week's menu on two sheets): up to 10 per submission, read together. Every
-- photo's path in the `submissions` bucket, in the order sent; photo_path stays the first, for what reads one.
alter table submissions add column photo_paths text[];
update submissions set photo_paths = array[photo_path] where photo_path is not null;
