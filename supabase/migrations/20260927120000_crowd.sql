-- Plimp crowd data: one-tap poll votes, numeric guesses, mistake reports, frozen poll snapshots
-- and rate-limit counters.
--
-- Access model: row-level security is on for every table and there are no policies, so the anon
-- and authenticated roles can do nothing. Only the Next.js server, using the secret key
-- (service_role, which bypasses RLS), reads or writes. Table and function privileges are revoked
-- from anon and authenticated as well, as a second line of defence.

-- ---------------------------------------------------------------------------------------------
-- Tables

create table public.votes (
  id bigint generated always as identity primary key,
  game text not null check (game ~ '^[a-z][a-z0-9-]{0,39}$'),
  poll_id text not null check (char_length(poll_id) between 1 and 96),
  option text not null check (char_length(option) between 1 and 32),
  device_id uuid not null,
  created_at timestamptz not null default now(),
  constraint votes_one_per_device unique (poll_id, device_id)
);

create index votes_poll_option_idx on public.votes (poll_id, option);
create index votes_created_at_idx on public.votes (created_at);

create table public.guesses (
  id bigint generated always as identity primary key,
  game text not null check (game ~ '^[a-z][a-z0-9-]{0,39}$'),
  puzzle integer not null check (puzzle > 0),
  item_id text not null check (char_length(item_id) between 1 and 64),
  value double precision not null check (value not in ('NaN', 'Infinity', '-Infinity')),
  device_id uuid not null,
  created_at timestamptz not null default now(),
  -- Also serves lookups by (game, puzzle, item_id).
  constraint guesses_one_per_device unique (game, puzzle, item_id, device_id)
);

create table public.reports (
  id bigint generated always as identity primary key,
  game text not null check (game ~ '^[a-z][a-z0-9-]{0,39}$'),
  item_id text not null check (char_length(item_id) between 1 and 64),
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now(),
  status text not null default 'new'
    check (status in ('new', 'confirmed', 'fixed', 'rejected'))
);

create index reports_status_created_at_idx on public.reports (status, created_at);

create table public.poll_snapshots (
  poll_id text not null,
  option text not null,
  votes integer not null check (votes >= 0),
  total integer not null check (total >= 0),
  frozen_at timestamptz not null,
  primary key (poll_id, frozen_at, option)
);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

create index rate_limits_window_start_idx on public.rate_limits (window_start);

-- ---------------------------------------------------------------------------------------------
-- Row-level security: on everywhere, no policies.

alter table public.votes enable row level security;
alter table public.guesses enable row level security;
alter table public.reports enable row level security;
alter table public.poll_snapshots enable row level security;
alter table public.rate_limits enable row level security;

revoke all on table
  public.votes, public.guesses, public.reports, public.poll_snapshots, public.rate_limits
  from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Functions

-- Records one hit for `p_key` in the current fixed window and returns true when the key has now
-- gone over `p_max` hits in that window (that is, when the caller hit the rate limit).
create function public.hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_window timestamptz :=
    to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;
  return v_count > p_max;
end;
$$;

-- Snapshots the vote split of every poll that is new or had votes in the last two days (the
-- overlap covers votes that commit while a freeze runs), then deletes rate-limit windows older
-- than a day. Returns the number of polls frozen. Run daily by /api/cron/freeze.
create function public.freeze_polls()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_polls integer;
begin
  with active as (
    select distinct v.poll_id
    from public.votes v
    where v.created_at > v_now - interval '2 days'
       or not exists (select 1 from public.poll_snapshots s where s.poll_id = v.poll_id)
  ),
  counts as (
    select v.poll_id, v.option, count(*)::integer as votes
    from public.votes v
    join active a on a.poll_id = v.poll_id
    group by v.poll_id, v.option
  ),
  totals as (
    select poll_id, sum(votes)::integer as total from counts group by poll_id
  ),
  inserted as (
    insert into public.poll_snapshots (poll_id, option, votes, total, frozen_at)
    select c.poll_id, c.option, c.votes, t.total, v_now
    from counts c
    join totals t on t.poll_id = c.poll_id
    returning poll_id
  )
  select count(distinct poll_id)::integer into v_polls from inserted;

  delete from public.rate_limits where window_start < v_now - interval '1 day';

  return v_polls;
end;
$$;

-- The split to show for a poll: the latest frozen snapshot if there is one, otherwise live counts
-- (frozen_at is null for live counts).
create function public.poll_results(p_poll_id text)
returns table (option text, votes integer, total integer, frozen_at timestamptz)
language sql
stable
set search_path = ''
as $$
  with latest as (
    select max(s.frozen_at) as frozen_at
    from public.poll_snapshots s
    where s.poll_id = p_poll_id
  )
  select s.option, s.votes, s.total, s.frozen_at
  from public.poll_snapshots s
  join latest l on s.frozen_at = l.frozen_at
  where s.poll_id = p_poll_id
  union all
  select v.option, count(*)::integer, sum(count(*)) over ()::integer, null::timestamptz
  from public.votes v
  where v.poll_id = p_poll_id
    and (select frozen_at from latest) is null
  group by v.option;
$$;

-- Number of guesses and their median for one item of one puzzle.
create function public.crowd_median(p_game text, p_puzzle integer, p_item text)
returns table (n integer, median double precision)
language sql
stable
set search_path = ''
as $$
  select count(*)::integer,
         percentile_cont(0.5) within group (order by g.value)
  from public.guesses g
  where g.game = p_game and g.puzzle = p_puzzle and g.item_id = p_item;
$$;

-- Histogram of the positive guesses for one item, in `p_bins` bins that are equally wide on a log
-- scale between the smallest and largest guess. Returns every bin, including empty ones, and no
-- rows when there are no positive guesses.
create function public.crowd_histogram(
  p_game text,
  p_puzzle integer,
  p_item text,
  p_bins integer default 12
)
returns table (bin integer, bin_from double precision, bin_to double precision, count integer)
language sql
stable
set search_path = ''
as $$
  with positive as (
    select ln(g.value) as lv
    from public.guesses g
    where g.game = p_game and g.puzzle = p_puzzle and g.item_id = p_item and g.value > 0
  ),
  bounds as (
    select min(lv) as lo, max(lv) as hi, greatest(1, least(coalesce(p_bins, 12), 100)) as bins
    from positive
  ),
  binned as (
    select case
             when b.hi = b.lo then 1
             else least(width_bucket(p.lv, b.lo, b.hi, b.bins), b.bins)
           end as bin
    from positive p
    cross join bounds b
  ),
  bins as (
    select i as bin,
           exp(b.lo + (i - 1) * (b.hi - b.lo) / b.bins) as bin_from,
           exp(b.lo + i * (b.hi - b.lo) / b.bins) as bin_to
    from bounds b
    cross join lateral generate_series(1, b.bins) as i
    where b.lo is not null
  )
  select bins.bin, bins.bin_from, bins.bin_to, count(binned.bin)::integer
  from bins
  left join binned on binned.bin = bins.bin
  group by bins.bin, bins.bin_from, bins.bin_to
  order by bins.bin;
$$;

revoke execute on function
  public.hit_rate_limit(text, integer, integer),
  public.freeze_polls(),
  public.poll_results(text),
  public.crowd_median(text, integer, text),
  public.crowd_histogram(text, integer, text, integer)
  from public, anon, authenticated;

grant execute on function
  public.hit_rate_limit(text, integer, integer),
  public.freeze_polls(),
  public.poll_results(text),
  public.crowd_median(text, integer, text),
  public.crowd_histogram(text, integer, text, integer)
  to service_role;
