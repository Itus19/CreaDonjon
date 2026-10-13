-- V3.1-96 (ADR 0048) — la Chronologie du monde.
--
-- Les événements ajoutés directement à la frise générale vivent dans le bloc
-- Chronologie d'une FICHE SYSTÈME, une par monde (`entity_kind =
-- 'world_timeline'`), hors des listes du wiki — plutôt qu'une table nouvelle,
-- qui aurait dû refaire visibilité, historique et droits d'écriture.
--
-- 1. Une seule par monde : index unique partiel (les fiches supprimées ne
--    comptent pas). Deux créations simultanées : la seconde échoue, le
--    service relit la première.
create unique index if not exists entities_world_timeline_unique
  on entities (world_id)
  where entity_kind = 'world_timeline' and deleted_at is null;

-- 2. Seul un MJ du monde la crée. Tout membre peut créer une entité
--    (`entities_insert`) : sans cette garde, un joueur pourrait poser la
--    fiche avant le MJ et occuper la place unique de la frise générale.
--    Les autres genres gardent la règle d'avant, inchangée.
drop policy if exists entities_insert on entities;
create policy entities_insert on entities for insert
  with check (
    app.is_world_member(world_id)
    and (entity_kind <> 'world_timeline' or app.is_world_admin(world_id))
  );
