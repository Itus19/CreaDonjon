-- Corrige une regression decouverte en direct (retour utilisateur : erreur
-- serveur systematique sur /joueur/notes, digest 352884070) --
-- "new row violates row-level security policy for table blocks".
--
-- `app.can_edit_entity` avait un 5e cas ("c'est sa propre fiche de notes
-- privee", entity_kind = 'notes' AND created_by = auth.uid(), migration
-- 20260830210001) qui documente encore aujourd'hui le mirroir TypeScript
-- (canEditEntity.ts, cas 5 "isOwnPrivateNotes"). Ce cas a ete perdu par
-- megarde : 20260902150001 (fix d'un tout autre bug, la suppression douce
-- des fiches) a reecrit toute la fonction et a laisse tomber ce cas au
-- passage ; 20260902150002 a reecrit la fonction une seconde fois (ajout de
-- `set row_security = off`) sur la meme base tronquee, sans le remarquer.
--
-- Consequence : `getOrCreateNoteTreeBlock` (src/server/services/notebook.ts)
-- insere le premier bloc `note_tree` d'un compte des sa premiere visite de
-- l'outil Notes, sur sa propre entite `notes` — la policy `blocks_insert`
-- (`with check (app.can_edit_entity(entity_id))`) le refusait pour tout
-- compte qui n'est ni admin du monde, ni MJ, ni proprietaire d'un PJ lie a
-- CETTE entite precise (l'entite `notes` n'est jamais un PJ).
create or replace function app.can_edit_entity(p_entity_id uuid)
returns boolean
language sql stable security definer set search_path = public, app set row_security = off as $$
  select
    app.is_world_admin(app.entity_world_id(p_entity_id))
    or exists (
         select 1 from campaign_characters cc
         join campaigns c on c.id = cc.campaign_id
         where c.world_id = app.entity_world_id(p_entity_id)
           and cc.entity_id = p_entity_id
           and cc.user_id = auth.uid()
       )
    or exists (select 1 from entity_grants g where g.entity_id = p_entity_id and g.user_id = auth.uid())
    or exists (
         select 1 from entities e
         where e.id = p_entity_id and e.entity_kind = 'notes' and e.created_by = auth.uid()
       );
$$;
