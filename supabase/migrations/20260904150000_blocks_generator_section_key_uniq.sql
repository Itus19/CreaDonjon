-- V2-J9 : empeche deux appels concurrents de ensureGeneratorToolsEntity
-- (src/server/services/entities.ts) de creer deux fois le meme bloc
-- generator pour une section de GENERATOR_TOOLS. Race trouvee en pratique
-- ce jour : 130 blocs "generator" identiques (cle "taverne-menu") crees
-- pour la meme entite, chaque appel relisant les cles existantes avant
-- que l'insertion precedente ne soit visible. Un seul bloc generator par
-- (entite, cle de section) desormais garanti au niveau base, pas
-- seulement par convention applicative.
create unique index blocks_generator_section_key_uniq
  on blocks (entity_id, (data->>'key'))
  where block_type = 'generator' and data->>'key' is not null;
