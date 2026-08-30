-- V2-M4 (suite) — meme correctif que 20260801140003_share_link_resolve_extensions_schema_fix.sql :
-- pgcrypto s'installe dans le schema `extensions` sur ce projet, jamais
-- dans `public`/`app`. `digest(p_token, 'sha256')` echouait donc dans
-- `app.resolve_campaign_invite` et `app.list_unclaimed_campaign_characters`
-- (erreur "function digest(text, unknown) does not exist", trouvee en
-- ecrivant le test d'integration). Qualification explicite
-- (`extensions.digest`) + cast `::bytea`, comme pour le partage public.

create or replace function app.resolve_campaign_invite(p_token text)
returns table (
  id uuid,
  campaign_id uuid,
  world_id uuid,
  intended_role text,
  claimed_by_user_id uuid,
  claimed_name text
)
language plpgsql
stable
security definer
set search_path = public, app
as $$
begin
  return query
    select ci.id, ci.campaign_id, ci.world_id, ci.intended_role, ci.claimed_by_user_id, ci.claimed_name
    from campaign_invites ci
    where ci.token_hash = encode(extensions.digest(p_token::bytea, 'sha256'), 'hex')
      and ci.revoked_at is null;
end;
$$;

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
  where ci.token_hash = encode(extensions.digest(p_token::bytea, 'sha256'), 'hex')
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
