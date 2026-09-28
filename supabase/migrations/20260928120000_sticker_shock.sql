-- Sticker Shock: per-pair accuracy for `pnpm sticker-shock:accuracy`, and the public `proofs`
-- storage bucket for price proof images (`pnpm sticker-shock:proofs`).

-- After each daily pair the game posts one guess per device: value 1 when the player picked the
-- pricier item, 0 when not. The share of players who got a pair right flags pairs that are too
-- easy (above 85%) or probably wrong (below 15%).
create view public.pair_accuracy
with (security_invoker = true)
as
select g.game,
       g.puzzle,
       g.item_id as pair_id,
       count(*)::integer as n,
       avg(g.value)::double precision as share_correct
from public.guesses g
where g.game = 'sticker-shock'
group by g.game, g.puzzle, g.item_id;

-- Same access model as the tables: only the server, with the secret key, reads it.
revoke all on table public.pair_accuracy from anon, authenticated;
grant select on table public.pair_accuracy to service_role;

-- Proof images: a public bucket (the game shows them to everyone), written only with the secret
-- key. Storage exists on every Supabase stack; the guard lets the SQL tests run without it.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('proofs', 'proofs', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end;
$$;
