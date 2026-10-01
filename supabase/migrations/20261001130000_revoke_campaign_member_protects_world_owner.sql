-- V3.1-15 (complément du 1er octobre) — retirer un second MJ de la campagne,
-- jamais le créateur du monde.
--
-- Constat : `app.revoke_campaign_member` (migration 20260929130000) vérifie
-- que l'APPELANT gère le monde (`app.is_world_admin`), mais ne regarde pas
-- la CIBLE. Or `is_world_admin` compte tout MJ de campagne du monde : un
-- second MJ, invité par lien, pouvait donc expulser le créateur du monde en
-- appelant la route directement. L'écran ne proposait pas ce geste ; la base
-- le permettait.
--
-- Décision de l'auteur : le ⋮ d'un second MJ propose « Retirer de la
-- campagne », comme pour un compte joueur. Le créateur (`worlds.owner_id`)
-- ne se retire jamais par ce geste — ce serait un transfert de monde, autre
-- opération, non demandée. Refusé ici, pas seulement masqué à l'écran.
--
-- Rien d'autre ne change : même transaction (libère le personnage tenu,
-- supprime la ligne `campaign_members`), lien d'invitation intact. Un MJ
-- invité au niveau d'une campagne n'a que sa ligne `campaign_members`
-- (`accountProvisioning.ts`) : la supprimer lui retire bien `is_world_admin`.
-- Un éditeur du monde (`world_members`, lien MJ de niveau monde) garde ses
-- droits sur le monde — c'est « Révoquer » sur son lien qui les retire.
--
-- Même signature : `create or replace` garde les `grant` existants.

create or replace function app.revoke_campaign_member(p_campaign_id uuid, p_user_id uuid)
returns table (allowed boolean, released_character boolean, removed_member boolean)
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_world uuid;
  v_released int := 0;
  v_removed int := 0;
begin
  v_world := app.campaign_world_id(p_campaign_id);

  if v_world is null or not (app.is_superadmin() or app.is_world_admin(v_world)) then
    return query select false, false, false;
    return;
  end if;

  -- Le créateur du monde ne se retire jamais, quel que soit l'appelant.
  if exists (select 1 from worlds w where w.id = v_world and w.owner_id = p_user_id) then
    return query select false, false, false;
    return;
  end if;

  update campaign_characters
    set user_id = null
    where campaign_id = p_campaign_id and user_id = p_user_id;
  get diagnostics v_released = row_count;

  delete from campaign_members
    where campaign_id = p_campaign_id and user_id = p_user_id;
  get diagnostics v_removed = row_count;

  return query select true, v_released > 0, v_removed > 0;
end;
$$;
