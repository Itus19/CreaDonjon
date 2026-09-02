-- Phase F2 (Lot I) — retire `entity_portraits` une fois la bascule vers
-- `entity_assets`/`assets` verifiee en direct : les 11 portraits existants
-- migres par `scripts/migrate-entity-portraits.ts --write`, un echantillon
-- (dont au moins un via l'interface reelle) confirme affiche correctement,
-- le flux televersement/remplacement/suppression/mise en page reteste
-- integralement contre les nouvelles routes, et l'acces anonyme (visiteur
-- non connecte, cle publique sans session) confirme fonctionnel de bout en
-- bout jusqu'aux octets reels du fichier.
drop table entity_portraits;
