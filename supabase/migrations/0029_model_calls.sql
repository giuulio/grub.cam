-- Model calls, 12 October 2026: every call the `submit` function makes to OpenAI (transcribing a board, checking a
-- member's photo, later checking a review), with the tokens it used and what it cost, so spending can be seen and
-- capped in dollars (LLM_DAILY_USD) rather than by a count of calls. OpenAI only from now on: Gemini is no longer
-- called, though old rows may still say it transcribed them.

create table model_calls (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  purpose text not null check (purpose in ('transcribe', 'vet_photo', 'review')),
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  cost_usd numeric(10, 6),                      -- null when the model's price (OPENAI_PRICE) wasn't set
  ok boolean not null default true,             -- false: it answered, but not usefully (nothing readable, a bad shape)
  submission_id uuid references submissions(id) on delete set null
);
create index model_calls_at_idx on model_calls(at);
comment on table model_calls is 'Every OpenAI call the submit function makes, with its tokens and cost; service role only.';

-- What the model couldn't read or guessed, for the person who checks it
alter table submissions add column unsure text;

alter table model_calls enable row level security;
