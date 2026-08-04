-- V1-C2 — RLS fine : descend la resolution de visibilite (SCHEMA.md §4.2,
-- src/core/visibility/canSee.ts) dans les politiques Postgres. Jusqu'ici,
-- `blocks_select`/`relations_select`/etc. ne verifiaient que l'appartenance
-- au monde (`app.is_world_member`) : n'importe quel membre du monde pouvait
-- lire un bloc `gm` par une requete brute, le filtrage fin (`filterBlocks`)
-- n'etant applique que cote service. Le filtrage service reste en place
-- (defense en profondeur) ; ceci ajoute le verrou qui manquait en dessous.
--
-- `app.visibility_permits` mirrors canSee() pour public/players/gm/user/
-- private a l'identique. Pour 'campaign', canSee() exige en plus que la
-- LECTURE ait lieu dans le contexte de cette campagne precise
-- (ctx.campaignId === scopeId) — une notion que RLS ne peut pas connaitre
-- (une politique ne voit que la ligne et auth.uid(), jamais "depuis quelle
-- page l'utilisateur navigue"). Rien dans l'application ne lit
-- actuellement de bloc avec un ctx.campaignId non vide (filterBlocks est
-- toujours appele sans contexte, verifie par grep avant d'ecrire cette
-- migration) : la nuance contextuelle reste donc, pour l'instant, un
-- raffinement service uniquement — documente ici plutot que suppose. La
-- garantie de securite reelle (jamais de fuite vers un non-membre de la
-- campagne) est bien portee par RLS.
create or replace function app.visibility_permits(
  p_world_id uuid,
  p_level text,
  p_scope_id uuid,
  p_created_by uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  v_world_role text;
begin
  if p_level = 'public' then
    return true;
  end if;

  if auth.uid() is null then
    return false;
  end if;

  select case
    when exists (select 1 from worlds w where w.id = p_world_id and w.owner_id = auth.uid()) then 'owner'
    else (select role from world_members wm where wm.world_id = p_world_id and wm.user_id = auth.uid())
  end into v_world_role;

  if p_level = 'players' then
    if v_world_role in ('owner', 'editor') then
      return true;
    end if;
    return exists (
      select 1 from campaign_members cm
      join campaigns c on c.id = cm.campaign_id
      where c.world_id = p_world_id and cm.user_id = auth.uid()
    );
  end if;

  if p_level = 'gm' then
    if v_world_role in ('owner', 'editor') then
      return true;
    end if;
    return exists (
      select 1 from campaign_members cm
      join campaigns c on c.id = cm.campaign_id
      where c.world_id = p_world_id and cm.user_id = auth.uid() and cm.role = 'gm'
    );
  end if;

  if p_level = 'campaign' then
    if p_scope_id is null then
      return false;
    end if;
    return app.campaign_role(p_scope_id) is not null;
  end if;

  if p_level = 'user' then
    return p_scope_id = auth.uid();
  end if;

  if p_level = 'private' then
    return p_created_by is not null and p_created_by = auth.uid();
  end if;

  return false;
end;
$$;

revoke execute on function app.visibility_permits(uuid, text, uuid, uuid) from public;
grant execute on function app.visibility_permits(uuid, text, uuid, uuid) to authenticated;

-- blocks : la seule table dont le monde s'obtient par jointure (entity_id -> entities.world_id).
drop policy if exists blocks_select on blocks;
create policy blocks_select on blocks for select
  using (
    exists (select 1 from entities e where e.id = blocks.entity_id and app.is_world_member(e.world_id))
    and app.visibility_permits(app.entity_world_id(blocks.entity_id), blocks.visibility_level, blocks.visibility_scope_id, blocks.created_by)
  );

-- relations, entity_mentions, chunks, assets : world_id est une colonne directe.
drop policy if exists relations_select on relations;
create policy relations_select on relations for select
  using (
    app.is_world_member(relations.world_id)
    and app.visibility_permits(relations.world_id, relations.visibility_level, relations.visibility_scope_id, relations.created_by)
  );

drop policy if exists entity_mentions_select on entity_mentions;
create policy entity_mentions_select on entity_mentions for select
  using (
    app.is_world_member(entity_mentions.world_id)
    and app.visibility_permits(entity_mentions.world_id, entity_mentions.visibility_level, entity_mentions.visibility_scope_id, null)
  );

drop policy if exists chunks_select on chunks;
create policy chunks_select on chunks for select
  using (
    app.is_world_member(chunks.world_id)
    and app.visibility_permits(chunks.world_id, chunks.visibility_level, chunks.visibility_scope_id, null)
  );

drop policy if exists assets_select on assets;
create policy assets_select on assets for select
  using (
    app.is_world_member(assets.world_id)
    and app.visibility_permits(assets.world_id, assets.visibility_level, assets.visibility_scope_id, assets.uploaded_by)
  );

-- Les politiques *_write ne changent pas : ce ticket verrouille la LECTURE
-- (les criteres portent sur "un joueur ne lit aucun bloc gm"), pas
-- l'ecriture — restreindre qui peut choisir quel niveau de visibilite est
-- un sujet distinct, non demande ici.
