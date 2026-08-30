-- V2-M7b (Lot M) — 5e cas de app.can_edit_entity, mirroir SQL exact de
-- canEditEntity.ts (src/core/permissions/canEditEntity.ts) : sa PROPRE
-- fiche de notes privee (entity_kind = 'notes', created_by = auth.uid()).
--
-- Sans ce cas, un joueur peut CREER sa fiche de notes (entities_insert
-- reste ouvert a tout membre du monde, migration 20260830110001) mais
-- jamais y toucher ensuite : aucun des quatre cas precedents (proprietaire/
-- editeur du monde, MJ de campagne, propre PJ, entity_grants) ne couvre
-- "je l'ai creee moi-meme".
create or replace function app.can_edit_entity(p_entity_id uuid)
returns boolean
language sql stable security definer set search_path = public, app as $$
  select
    exists (select 1 from entities e where e.id = p_entity_id)
    and (
      app.is_world_admin(app.entity_world_id(p_entity_id))
      or exists (
           select 1 from campaign_characters cc
           join campaigns c on c.id = cc.campaign_id
           where c.world_id = app.entity_world_id(p_entity_id)
             and cc.entity_id = p_entity_id
             and cc.user_id = auth.uid()
         )
      or exists (select 1 from entity_grants g where g.entity_id = p_entity_id and g.user_id = auth.uid())
      or exists (select 1 from entities e where e.id = p_entity_id and e.entity_kind = 'notes' and e.created_by = auth.uid())
    );
$$;
