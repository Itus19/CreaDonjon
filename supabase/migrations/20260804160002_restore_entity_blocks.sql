-- V1-C3 — decouverte en testant la restauration d'une revision : Postgres
-- applique IMPLICITEMENT la politique SELECT d'une table, en plus de la
-- politique UPDATE/DELETE elle-meme, pour determiner quelles lignes une
-- commande UPDATE/DELETE peut cibler (la ligne doit d'abord etre "visible"
-- au sens SELECT pour meme entrer dans le plan d'execution). Consequence
-- concrete verifiee empiriquement : un joueur qui declenche une
-- restauration ne peut PAS supprimer un bloc `gm` existant via
-- `delete from blocks where entity_id = ...` avec son propre client — la
-- ligne echoue silencieusement le ciblage (aucune erreur, juste absente du
-- resultat), meme si `blocks_delete` (is_world_member seul, sans
-- visibility_permits) l'autoriserait en apparence. Meme famille de probleme
-- que la lecture d'historique (migration 20260804160001), mais cote
-- ecriture cette fois.
--
-- Meme solution : une fonction security definer bornee par is_world_member,
-- jamais par un role plus large. Elle ne fait rien que l'ecriture normale
-- ne permettait deja (n'importe quel membre du monde peut deja creer un
-- bloc a n'importe quel niveau de visibilite, cf. blocks_insert) — elle
-- contourne seulement la restriction de CIBLAGE du delete/insert groupe,
-- pas une restriction de droit.
create or replace function public.restore_entity_blocks(p_entity_id uuid, p_blocks jsonb)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_world_id uuid;
begin
  select world_id into v_world_id from entities where id = p_entity_id;
  if v_world_id is null or not app.is_world_member(v_world_id) then
    raise exception 'entite introuvable ou acces refuse';
  end if;

  delete from blocks where entity_id = p_entity_id;

  insert into blocks (entity_id, block_type, display, data, display_order, visibility_level, visibility_scope_id, created_by)
  select
    p_entity_id,
    b->>'blockType',
    b->'display',
    b->'data',
    (b->>'displayOrder')::numeric,
    b->>'visibilityLevel',
    nullif(b->>'visibilityScopeId', '')::uuid,
    nullif(b->>'createdBy', '')::uuid
  from jsonb_array_elements(p_blocks) as b;
end;
$$;

revoke execute on function public.restore_entity_blocks(uuid, jsonb) from public;
grant execute on function public.restore_entity_blocks(uuid, jsonb) to authenticated;
