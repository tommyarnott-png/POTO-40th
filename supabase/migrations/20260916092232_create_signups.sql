-- Signups captured by the microsite's download gate.
--
-- Only the Worker's service key ever writes here. Row level security is on and no
-- policy grants anon or authenticated anything, and their table privileges are
-- revoked outright, so a key leaking into a browser bundle would still read nothing.
create table public.signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  first_name text not null,
  last_name text not null,
  email text not null,

  postcode text,
  country text,
  favourite_musical text,
  -- Set only when day, month and year were all given. Three loose columns would let
  -- a half-entered birthday through looking like data.
  date_of_birth date,

  marketing_consent boolean not null,
  -- The wording actually shown and agreed to, kept verbatim, so that changing the
  -- copy later cannot rewrite what somebody consented to.
  consent_text text not null,

  -- Which offer brought them: the source archive or their own mix.
  download text not null,
  source text not null default 'poto-40th-microsite'
);

-- Deliberately not unique. Every submission is its own consent event with its own
-- timestamp and wording, and an upsert would overwrite exactly the record that
-- consent_text exists to preserve. The mailing export groups by address instead.
create index signups_email_idx on public.signups (email);

alter table public.signups enable row level security;

revoke all on public.signups from anon, authenticated;
