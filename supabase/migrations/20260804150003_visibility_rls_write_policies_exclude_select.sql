-- V1-C2 (correctif) : trouve en verifiant la migration 20260804150001 par
-- un test comparatif reel (visibilityRls.integration.test.ts). Chaque
-- politique "for all" (blocks_write, relations_write, entity_mentions_write,
-- chunks_write, assets_write) s'applique AUSSI a select — Postgres combine
-- plusieurs politiques permissives par OR (documentation officielle :
-- "a row is visible if ANY policy grants access"). Leur verification
-- (uniquement `app.is_world_member`, jamais `app.visibility_permits`)
-- annulait donc silencieusement le verrou pose par blocks_select et les
-- autres `_select` de la migration 20260804150001 : un membre du monde
-- repassait par la politique `_write`, plus laxiste, pour lire n'importe
-- quel bloc/relation/mention/chunk/asset quel que soit son niveau de
-- visibilite. Chaque `_write` est scindee en insert/update/delete (jamais
-- select) : la lecture ne passe plus que par `_select`.
--
-- L'ecriture elle-meme reste inchangee (meme verification qu'avant,
-- `is_world_member` seul) : ce ticket verrouille la lecture, pas qui peut
-- choisir quel niveau de visibilite (cf. commentaire de fin de la migration
-- 20260804150001).

drop policy if exists blocks_write on blocks;
create policy blocks_insert on blocks for insert
  with check (exists (select 1 from entities e where e.id = blocks.entity_id and app.is_world_member(e.world_id)));
create policy blocks_update on blocks for update
  using (exists (select 1 from entities e where e.id = blocks.entity_id and app.is_world_member(e.world_id)))
  with check (exists (select 1 from entities e where e.id = blocks.entity_id and app.is_world_member(e.world_id)));
create policy blocks_delete on blocks for delete
  using (exists (select 1 from entities e where e.id = blocks.entity_id and app.is_world_member(e.world_id)));

drop policy if exists relations_write on relations;
create policy relations_insert on relations for insert with check (app.is_world_member(world_id));
create policy relations_update on relations for update using (app.is_world_member(world_id)) with check (app.is_world_member(world_id));
create policy relations_delete on relations for delete using (app.is_world_member(world_id));

drop policy if exists entity_mentions_write on entity_mentions;
create policy entity_mentions_insert on entity_mentions for insert with check (app.is_world_member(world_id));
create policy entity_mentions_update on entity_mentions for update using (app.is_world_member(world_id)) with check (app.is_world_member(world_id));
create policy entity_mentions_delete on entity_mentions for delete using (app.is_world_member(world_id));

drop policy if exists chunks_write on chunks;
create policy chunks_insert on chunks for insert with check (app.is_world_member(world_id));
create policy chunks_update on chunks for update using (app.is_world_member(world_id)) with check (app.is_world_member(world_id));
create policy chunks_delete on chunks for delete using (app.is_world_member(world_id));

drop policy if exists assets_write on assets;
create policy assets_insert on assets for insert with check (app.is_world_member(world_id));
create policy assets_update on assets for update using (app.is_world_member(world_id)) with check (app.is_world_member(world_id));
create policy assets_delete on assets for delete using (app.is_world_member(world_id));
