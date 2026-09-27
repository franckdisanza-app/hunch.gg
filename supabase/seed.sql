-- Local development seed (runs on `supabase db reset`). Obviously fake data only: an
-- "example-game" that does not exist, made-up polls and guesses, and a fake report.

-- 250 votes on a fake poll, enough to pass the 200-vote minimum.
insert into public.votes (game, poll_id, option, device_id)
select 'example-game', 'example-game:fake-poll', case when i % 3 = 0 then 'b' else 'a' end,
       gen_random_uuid()
from generate_series(1, 250) as i;

-- 60 votes on a second fake poll, below the minimum.
insert into public.votes (game, poll_id, option, device_id)
select 'example-game', 'example-game:small-poll', case when i % 2 = 0 then 'b' else 'a' end,
       gen_random_uuid()
from generate_series(1, 60) as i;

-- 80 fake guesses spread over several orders of magnitude, enough for a median.
insert into public.guesses (game, puzzle, item_id, value, device_id)
select 'example-game', 1, 'fake-item', round((10 ^ (1 + (i % 40) / 10.0))::numeric, 2),
       gen_random_uuid()
from generate_series(1, 80) as i;

insert into public.reports (game, item_id, message)
values ('example-game', 'fake-item', 'Fake report for local development.');
