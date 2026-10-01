-- V3.1-15 (bug trouvé en jouant, 1er octobre) — révoquer un lien JOUEUR
-- n'expulse plus personne.
--
-- Constat : l'auteur a révoqué les liens joueur en double pour n'en garder
-- qu'un — et les joueuses ont disparu de « À la table », leur personnage
-- libéré. L'écran promettait l'inverse : « Celles qui l'ont déjà utilisé
-- gardent leur accès » (`InviteLinkPanel.tsx`).
--
-- Cause : `app.revoke_campaign_invite_access` (migration 20260917100000,
-- V2.1-25) retire l'accès de `claimed_by_user_id`. Depuis V3.1-10 (ADR 0031)
-- un lien joueur est réutilisable et n'écrit plus `claimed_by_user_id`
-- — mais les liens créés AVANT, sous l'ancien régime à usage unique, le
-- portent encore. Révoquer l'un d'eux expulsait donc la joueuse qui s'en
-- était servie la première.
--
-- Décision : un lien joueur révoqué cesse seulement de fonctionner.
-- `campaign_members` fait foi de qui joue (ADR 0031) ; retirer quelqu'un,
-- c'est « Retirer de la campagne » dans son ⋮. Un lien MJ (nominatif, usage
-- unique) garde l'ancien comportement : le révoquer retire bien son MJ.
--
-- Même signature : `create or replace` garde les `grant` existants. Corps
-- repris à l'identique de 20260917100000, seul le test du rôle est ajouté.

create or replace function app.revoke_campaign_invite_access(p_invite_id uuid)
returns table (
  allowed boolean,
  revoked boolean,
  released_character boolean,
  removed_member boolean,
  removed_world_member boolean
)
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_campaign uuid;
  v_invite_world uuid;
  v_world uuid;
  v_user uuid;
  v_role text;
  v_released int := 0;
  v_removed int := 0;
  v_removed_world int := 0;
  v_revoked int := 0;
begin
  select ci.campaign_id, ci.world_id, ci.claimed_by_user_id, ci.intended_role
    into v_campaign, v_invite_world, v_user, v_role
  from campaign_invites ci
  where ci.id = p_invite_id;

  if not found then
    return query select false, false, false, false, false;
    return;
  end if;

  v_world := coalesce(app.campaign_world_id(v_campaign), v_invite_world);

  if v_world is null or not app.is_world_admin(v_world) then
    return query select false, false, false, false, false;
    return;
  end if;

  -- Lien joueur : on ne touche jamais à l'accès de qui s'en est servi.
  if v_user is not null and v_role is distinct from 'player' then
    if v_campaign is not null then
      update campaign_characters
        set user_id = null
        where campaign_id = v_campaign and user_id = v_user;
      get diagnostics v_released = row_count;

      delete from campaign_members
        where campaign_id = v_campaign and user_id = v_user;
      get diagnostics v_removed = row_count;
    end if;

    if v_invite_world is not null then
      delete from world_members
        where world_id = v_invite_world and user_id = v_user;
      get diagnostics v_removed_world = row_count;
    end if;
  end if;

  update campaign_invites
    set revoked_at = now()
    where id = p_invite_id and revoked_at is null;
  get diagnostics v_revoked = row_count;

  return query select true, v_revoked > 0, v_released > 0, v_removed > 0, v_removed_world > 0;
end;
$$;
