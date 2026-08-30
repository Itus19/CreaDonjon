-- V2-M6 (Lot M) — section Administration superadmin sur l'ecran d'accueil.
--
-- Le superadmin doit voir/gerer les liens d'invitation et le journal
-- d'activite de TOUS les mondes, pas seulement les siens (`is_world_admin`
-- resterait borne a "les mondes ou JE suis MJ/proprietaire"). Meme
-- discipline que l'ADR 0014 (superadmin via une fonction RLS dediee,
-- jamais le client service-role) : chaque politique concernee est
-- reecrite une a une pour ajouter `or app.is_superadmin()`, jamais un
-- contournement global.

drop policy campaign_invites_select on campaign_invites;
create policy campaign_invites_select on campaign_invites for select
  using (
    app.is_superadmin()
    or (campaign_id is not null and app.is_world_admin(app.campaign_world_id(campaign_id)))
    or (world_id is not null and app.is_world_admin(world_id))
  );

drop policy campaign_invites_write on campaign_invites;
create policy campaign_invites_write on campaign_invites for all
  using (
    app.is_superadmin()
    or (campaign_id is not null and app.is_world_admin(app.campaign_world_id(campaign_id)))
    or (world_id is not null and app.is_world_admin(world_id))
  )
  with check (
    app.is_superadmin()
    or (campaign_id is not null and app.is_world_admin(app.campaign_world_id(campaign_id)))
    or (world_id is not null and app.is_world_admin(world_id))
  );

-- Lecture seule pour le journal fusionne (V2-M6) : le superadmin ne
-- MODIFIE jamais une revision/un evenement depuis ce panneau, seulement
-- les liste. Les politiques `_write` de ces deux tables restent donc
-- inchangees (is_world_member seul).
drop policy entity_revisions_select on entity_revisions;
create policy entity_revisions_select on entity_revisions for select
  using (app.is_superadmin() or app.is_world_member(app.entity_world_id(entity_id)));

drop policy session_events_select on session_events;
create policy session_events_select on session_events for select
  using (app.is_superadmin() or app.is_world_member(app.session_world_id(session_id)));

-- `app.set_campaign_invite_password` (migration 20260830160001) verifie
-- deja `is_world_admin` OU `claimed_by_user_id = auth.uid()` a
-- l'interieur d'elle-meme : le superadmin doit pouvoir y passer aussi
-- (reinitialiser un mot de passe pour un ami qui l'a perdu).
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

  if not (app.is_superadmin() or app.is_world_admin(v_effective_world_id) or v_claimed_by = auth.uid()) then
    return false;
  end if;

  update campaign_invites set password_hash = p_password_hash, password_attempts = 0 where id = p_invite_id;
  return true;
end;
$$;
