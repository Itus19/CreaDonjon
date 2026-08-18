-- Bug de concurrence (rapporte en jouant, hors ticket V1-C3) : deux blocs de
-- la MEME entite sauvegardes a quelques millisecondes d'intervalle (deux
-- PATCH /api/blocks/[blockId] qui se chevauchent, ex. handleBlockBlur sur
-- deux blocs differents) produisaient un 500 —
-- "duplicate key value violates unique constraint
-- entity_revisions_entity_id_revision_number_key".
--
-- Cause : nextRevisionNumber() (SELECT max(revision_number)+1) et
-- insertEntityRevision() (INSERT) etaient deux requetes SQL separees, cote
-- TypeScript (src/server/repos/entityRevisions.ts). Rien n'empechait deux
-- appels concurrents de lire le meme max avant que l'un des deux n'insere —
-- le commentaire de recordEntityRevision (entityHistory.ts) supposait ce
-- risque "partage avec le reste de l'app", ce qui s'est revele faux en
-- pratique : les versions optimistes sur blocks/entities RENVOIENT un
-- conflit gerable (409), ceci PLANTAIT (500).
--
-- Correction : les deux operations dans une seule fonction SQL, serialisees
-- par un verrou consultatif par entite (pg_advisory_xact_lock), tenu jusqu'a
-- la fin de la transaction de l'appel RPC — un deuxieme appel concurrent sur
-- la meme entite attend que le premier commite (et libere le verrou) avant
-- de lire le max, au lieu de lire le meme max perime.
--
-- `security invoker` (par defaut, explicite) : aucune elevation de
-- privilege, la RLS normale de entity_revisions (is_world_member, migration
-- 20260730150001) s'applique telle quelle au SELECT et a l'INSERT internes
-- — cette fonction ne fait rien qu'un appelant autorise ne pouvait deja
-- faire en deux requetes, elle rend seulement la sequence atomique.
create or replace function public.insert_entity_revision(
  p_entity_id uuid,
  p_snapshot jsonb,
  p_change_source text,
  p_change_note text,
  p_changed_by uuid
)
returns entity_revisions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row entity_revisions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_entity_id::text, 0));

  insert into entity_revisions (entity_id, revision_number, snapshot, change_source, change_note, changed_by)
  select p_entity_id, coalesce(max(revision_number), 0) + 1, p_snapshot, p_change_source, p_change_note, p_changed_by
  from entity_revisions
  where entity_id = p_entity_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.insert_entity_revision(uuid, jsonb, text, text, uuid) from public;
grant execute on function public.insert_entity_revision(uuid, jsonb, text, text, uuid) to authenticated;
