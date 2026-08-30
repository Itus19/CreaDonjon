-- V2-M4 (suite, retour utilisateur 30 aout) — deux demandes :
-- 1. Mot de passe optionnel sur un lien d'invitation, modifiable par le
--    superadmin/MJ OU par la personne qui a reclame ce lien (jamais un
--    tiers) — meme mecanisme que share_links (migration 20260809210001),
--    mais AUCUNE ecriture large sur campaign_invites pour le second cas :
--    une fonction dediee qui ne touche jamais qu'une seule colonne.
-- 2. Le jeton en clair est desormais conserve (meme decision que
--    share_links, migration 20260826180001) : une liste peut le
--    recopier plus tard, pas seulement au moment de la creation.

alter table campaign_invites
  add column token text,
  add column password_hash text,
  add column password_attempts int not null default 0;

comment on column campaign_invites.token is 'Jeton en clair, conserve (retour utilisateur, meme choix que share_links) — recuperable depuis la liste, pas seulement a la creation. NULL pour un lien cree avant cette colonne.';
comment on column campaign_invites.password_hash is 'Hachage scrypt sale (src/core/shareLinks/password.ts, reutilise tel quel). NULL = pas de mot de passe.';
comment on column campaign_invites.password_attempts is 'Tentatives echouees consecutives depuis la derniere reussite — limite la force brute, meme regle que share_links.';

-- Un membre invite peut desormais lire SA PROPRE ligne (pour savoir si
-- elle a deja un mot de passe, avant de le changer) — jamais celle d'un
-- autre. Politique ajoutee, pas remplacee : Postgres combine les
-- politiques permissives par OR.
create policy campaign_invites_select_own on campaign_invites for select
  using (claimed_by_user_id = auth.uid());

-- Postgres refuse un CREATE OR REPLACE qui change les colonnes de sortie
-- d'une fonction existante (meme contrainte rencontree pour
-- share_link_password) — DROP explicite d'abord.
drop function if exists public.resolve_campaign_invite(text);
drop function if exists app.resolve_campaign_invite(text);

create function app.resolve_campaign_invite(p_token text)
returns table (
  id uuid,
  campaign_id uuid,
  world_id uuid,
  intended_role text,
  claimed_by_user_id uuid,
  claimed_name text,
  password_hash text,
  password_attempts int
)
language plpgsql
stable
security definer
set search_path = public, app
as $$
begin
  return query
    select ci.id, ci.campaign_id, ci.world_id, ci.intended_role, ci.claimed_by_user_id, ci.claimed_name,
           ci.password_hash, ci.password_attempts
    from campaign_invites ci
    where ci.token_hash = encode(extensions.digest(p_token::bytea, 'sha256'), 'hex')
      and ci.revoked_at is null;
end;
$$;

revoke execute on function app.resolve_campaign_invite(text) from public;
grant execute on function app.resolve_campaign_invite(text) to anon, authenticated;

create function public.resolve_campaign_invite(p_token text)
returns table (
  id uuid,
  campaign_id uuid,
  world_id uuid,
  intended_role text,
  claimed_by_user_id uuid,
  claimed_name text,
  password_hash text,
  password_attempts int
)
language sql
stable
security invoker
set search_path = public
as $$
  select * from app.resolve_campaign_invite(p_token);
$$;

revoke execute on function public.resolve_campaign_invite(text) from public;
grant execute on function public.resolve_campaign_invite(text) to anon, authenticated;

-- Journalise une tentative de mot de passe, meme motif que
-- app.record_share_link_password_attempt (l'anon n'a pas d'acces RLS en
-- ecriture a campaign_invites).
create or replace function app.record_campaign_invite_password_attempt(p_token text, p_success boolean)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
begin
  update campaign_invites
  set password_attempts = case when p_success then 0 else password_attempts + 1 end
  where token_hash = encode(extensions.digest(p_token::bytea, 'sha256'), 'hex')
    and revoked_at is null;
end;
$$;

revoke execute on function app.record_campaign_invite_password_attempt(text, boolean) from public;
grant execute on function app.record_campaign_invite_password_attempt(text, boolean) to anon, authenticated;

create or replace function public.record_campaign_invite_password_attempt(p_token text, p_success boolean)
returns void
language sql
security invoker
set search_path = public
as $$
  select app.record_campaign_invite_password_attempt(p_token, p_success);
$$;

revoke execute on function public.record_campaign_invite_password_attempt(text, boolean) from public;
grant execute on function public.record_campaign_invite_password_attempt(text, boolean) to anon, authenticated;

-- Changer le mot de passe : le superadmin/MJ (is_world_admin) OU la
-- personne qui a reclame ce lien (jamais un tiers) — verifie ICI, a
-- l'interieur de la fonction, jamais par une politique RLS large sur
-- toute la ligne (qui aurait laisse l'ami reecrire n'importe quel autre
-- champ, y compris son propre role ou la campagne visee).
create or replace function app.set_campaign_invite_password(p_invite_id uuid, p_password_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_campaign_id uuid;
  v_world_id uuid;
  v_claimed_by uuid;
  v_effective_world_id uuid;
begin
  select ci.campaign_id, ci.world_id, ci.claimed_by_user_id
    into v_campaign_id, v_world_id, v_claimed_by
  from campaign_invites ci
  where ci.id = p_invite_id;

  if not found then
    return false;
  end if;

  v_effective_world_id := coalesce(v_world_id, app.campaign_world_id(v_campaign_id));

  if not (app.is_world_admin(v_effective_world_id) or v_claimed_by = auth.uid()) then
    return false;
  end if;

  update campaign_invites set password_hash = p_password_hash, password_attempts = 0 where id = p_invite_id;
  return true;
end;
$$;

revoke execute on function app.set_campaign_invite_password(uuid, text) from public;
grant execute on function app.set_campaign_invite_password(uuid, text) to authenticated;

create or replace function public.set_campaign_invite_password(p_invite_id uuid, p_password_hash text)
returns boolean
language sql
security invoker
set search_path = public
as $$
  select app.set_campaign_invite_password(p_invite_id, p_password_hash);
$$;

revoke execute on function public.set_campaign_invite_password(uuid, text) from public;
grant execute on function public.set_campaign_invite_password(uuid, text) to authenticated;
