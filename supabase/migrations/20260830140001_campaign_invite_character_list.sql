-- V2-M4 (Lot M) — la page /rejoindre/[token] doit lister les personnages
-- non reclames AVANT que la personne n'ait la moindre session (elle n'a
-- justement pas encore de compte au premier passage) : `campaign_characters`
-- et `entities` restent proteges par leur RLS ordinaire (`is_world_member`),
-- inatteignable par un visiteur anonyme. Meme necessite et meme reponse que
-- `app.resolve_campaign_invite` (migration 20260830130001) — le jeton, une
-- fois revalide ICI (jamais fait confiance a un campaign_id fourni tel
-- quel), est la seule preuve d'acces necessaire a cette liste precise.

create or replace function app.list_unclaimed_campaign_characters(p_token text)
returns table (entity_id uuid, entity_name text)
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  v_campaign_id uuid;
begin
  select ci.campaign_id into v_campaign_id
  from campaign_invites ci
  where ci.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and ci.revoked_at is null;

  if v_campaign_id is null then
    return;
  end if;

  return query
    select e.id, e.name
    from campaign_characters cc
    join entities e on e.id = cc.entity_id
    where cc.campaign_id = v_campaign_id
      and cc.is_pc = true
      and cc.user_id is null
      and e.deleted_at is null
    order by e.name;
end;
$$;

revoke execute on function app.list_unclaimed_campaign_characters(text) from public;
grant execute on function app.list_unclaimed_campaign_characters(text) to anon, authenticated;

create or replace function public.list_unclaimed_campaign_characters(p_token text)
returns table (entity_id uuid, entity_name text)
language sql
stable
security invoker
set search_path = public
as $$
  select * from app.list_unclaimed_campaign_characters(p_token);
$$;

revoke execute on function public.list_unclaimed_campaign_characters(text) from public;
grant execute on function public.list_unclaimed_campaign_characters(text) to anon, authenticated;
