-- Members' price lists and hours go up without a person, 12 October 2026, as their menus do: the sender confirms the
-- model's reading, a check passes (a model compares an edited reading with the photo), and the publishing Action
-- saves it. What it replaced is kept with the submission, so `submissions -- reject` can put it back.
alter table submissions add column replaced jsonb;

-- The check that a reading the sender edited still says what the photo does
alter table model_calls drop constraint model_calls_purpose_check;
alter table model_calls add constraint model_calls_purpose_check check (purpose in ('transcribe', 'vet_photo', 'review', 'check_reading'));
