-- Ajoute `display` a `blocks`, absent de la migration 003 alors que
-- specs/wiki-blocs.md §1 et SCHEMA.md §7 decrivent la meme enveloppe que
-- `ruleset_entry_blocks` (block_type, display, data) — colonne deja
-- presente sur cette derniere depuis la migration 004. Purement additif :
-- la table `blocks` est vide, aucune donnee a migrer (V0-04).

alter table blocks add column display jsonb not null default '{}'::jsonb;
